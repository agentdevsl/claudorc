import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';
import { createId } from '@paralleldrive/cuid2';
import type { TerraformModule } from '../db/schema/terraform.js';
import { DEFAULT_TASK_CREATION_MODEL, getFullModelId } from '../lib/constants/models.js';
import type { TerraformError } from '../lib/errors/terraform-errors.js';
import { buildCompositionSystemPrompt } from '../lib/terraform/compose-prompt.js';
import type {
  ComposeEvent,
  ComposeMessage,
  ComposeStage,
  ModuleMatch,
} from '../lib/terraform/types.js';
import type { Result } from '../lib/utils/result.js';
import { ok } from '../lib/utils/result.js';
import type { TerraformRegistryService } from './terraform-registry.service.js';

const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
const KEEPALIVE_MS = 15_000;

export interface ComposeSession {
  id: string;
  messages: ComposeMessage[];
  matchedModules: ModuleMatch[];
  generatedCode: string | null;
  lastAccessedAt: number;
}

/**
 * Streaming compose job.
 * The SSE controller is stored directly so `runPipeline` can push events
 * via `controller.enqueue()` — matching the pattern used by sessions,
 * task-creation, and cli-monitor SSE endpoints.
 */
interface ComposeJob {
  controller: ReadableStreamDefaultController<Uint8Array> | null;
  finished: boolean;
  keepaliveInterval: ReturnType<typeof setInterval> | null;
}

const encoder = new TextEncoder();

/** Shape of the raw stream event from the Agent SDK. */
interface AgentStreamEvent {
  type: string;
  delta?: { type: string; text?: string };
  message?: { model?: string; usage?: { input_tokens?: number; output_tokens?: number } };
  usage?: { input_tokens?: number; output_tokens?: number };
}

/** Shape of a raw assistant message from the Agent SDK. */
interface AgentAssistantMessage {
  message?: {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
}

export class TerraformComposeService {
  private sessions = new Map<string, ComposeSession>();
  private jobs = new Map<string, ComposeJob>();

  constructor(private registryService: TerraformRegistryService) {}

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
        this.jobs.delete(id);
      }
    }
    // Evict oldest if over max
    if (this.sessions.size > MAX_SESSIONS) {
      const sorted = [...this.sessions.entries()].sort(
        (a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt
      );
      const toRemove = sorted.slice(0, this.sessions.size - MAX_SESSIONS);
      for (const [id] of toRemove) {
        this.sessions.delete(id);
        this.jobs.delete(id);
      }
    }
  }

  /**
   * Start a compose job in the background and return the session ID immediately.
   * The caller then connects to `subscribeToJob()` via a separate GET SSE endpoint.
   */
  async startCompose(
    sessionId: string | undefined,
    messages: ComposeMessage[],
    registryId?: string
  ): Promise<Result<{ sessionId: string }, TerraformError>> {
    const sid = sessionId || createId();

    this.cleanupSessions();

    // Create the job — controller will be set when subscriber connects
    const job: ComposeJob = {
      controller: null,
      finished: false,
      keepaliveInterval: null,
    };
    this.jobs.set(sid, job);

    // Run pipeline without awaiting — the caller returns the session ID immediately.
    this.runPipeline(sid, messages, registryId, job).catch((pipelineErr) => {
      console.error('[TerraformCompose] Unhandled pipeline error:', pipelineErr);
      this.sendEvent(job, {
        type: 'error',
        error: 'An unexpected error occurred. Please try again.',
      });
      this.finishJob(job);
    });

    return ok({ sessionId: sid });
  }

  /**
   * Subscribe to a compose job's event stream.
   * Returns a ReadableStream of SSE-formatted bytes.
   * The controller is stored on the job so runPipeline can push events directly.
   */
  subscribeToJob(sessionId: string): ReadableStream<Uint8Array> | null {
    const job = this.jobs.get(sessionId);
    if (!job) return null;

    return new ReadableStream<Uint8Array>({
      start(controller) {
        job.controller = controller;

        // Keep-alive ping every 15s to prevent proxy/Bun idle timeouts
        job.keepaliveInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': keepalive\n\n'));
          } catch {
            // Stream may be closed
          }
        }, KEEPALIVE_MS);

        // If the job already finished before subscriber connected, close immediately
        if (job.finished) {
          if (job.keepaliveInterval) clearInterval(job.keepaliveInterval);
          controller.close();
        }
      },
      cancel() {
        if (job.keepaliveInterval) clearInterval(job.keepaliveInterval);
        job.controller = null;
      },
    });
  }

  private sendEvent(job: ComposeJob, event: ComposeEvent): void {
    if (!job.controller) return;
    try {
      job.controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
    } catch {
      // Stream may be closed
    }
  }

  private sendStatus(job: ComposeJob, stage: ComposeStage): void {
    this.sendEvent(job, { type: 'status', stage });
  }

  private finishJob(job: ComposeJob): void {
    job.finished = true;
    if (job.keepaliveInterval) {
      clearInterval(job.keepaliveInterval);
      job.keepaliveInterval = null;
    }
    if (job.controller) {
      try {
        job.controller.close();
      } catch {
        // controller may already be closed
      }
      job.controller = null;
    }
  }

  /**
   * Wait for the subscriber to connect before pushing events.
   * The POST /compose returns the sessionId, then the client connects
   * to GET /compose/:sessionId/events which sets job.controller.
   */
  private async waitForSubscriber(job: ComposeJob, maxWaitMs = 10_000): Promise<boolean> {
    const start = Date.now();
    while (!job.controller && Date.now() - start < maxWaitMs) {
      await new Promise((r) => setTimeout(r, 50));
    }
    return !!job.controller;
  }

  private async runPipeline(
    sid: string,
    messages: ComposeMessage[],
    registryId: string | undefined,
    job: ComposeJob
  ): Promise<void> {
    // Wait for the SSE subscriber to connect before pushing events
    const subscriberReady = await this.waitForSubscriber(job);
    if (!subscriberReady) {
      console.warn('[TerraformCompose] No subscriber connected within timeout, aborting pipeline');
      this.finishJob(job);
      return;
    }

    let session: ReturnType<typeof unstable_v2_createSession> | null = null;

    try {
      // Stage 1: Load module catalog
      this.sendStatus(job, 'loading_catalog');

      const contextResult = await this.registryService.getModuleContext(registryId);
      if (!contextResult.ok) {
        this.sendEvent(job, {
          type: 'error',
          error: contextResult.error.message ?? 'Failed to load module catalog',
        });
        return;
      }

      const systemPrompt = buildCompositionSystemPrompt(contextResult.value);

      const modulesResult = await this.registryService.listModules(
        registryId ? { registryId } : undefined
      );
      if (!modulesResult.ok) {
        console.error(
          '[TerraformComposeService] Failed to load modules for matching:',
          modulesResult.error
        );
      }
      const allModules = modulesResult.ok ? modulesResult.value : [];

      // Stage 2: Analyzing requirements (streaming with Agent SDK)
      this.sendStatus(job, 'analyzing');

      const prompt = formatPrompt(systemPrompt, messages);
      const composeModel = getFullModelId(
        process.env.TERRAFORM_COMPOSE_MODEL ?? DEFAULT_TASK_CREATION_MODEL
      );

      session = unstable_v2_createSession({
        model: composeModel,
        env: { ...process.env },
      });

      await session.send(prompt);

      let fullResponse = '';
      let inputTokens = 0;
      let outputTokens = 0;

      for await (const msg of session.stream()) {
        if (msg.type === 'stream_event') {
          const event = msg.event as AgentStreamEvent;

          // Capture usage from message_start
          if (event.type === 'message_start' && event.message?.usage) {
            inputTokens = event.message.usage.input_tokens ?? 0;
          }

          // Capture output token usage from message_delta
          if (event.type === 'message_delta' && event.usage) {
            outputTokens = event.usage.output_tokens ?? 0;
          }

          // Stream text deltas to the client as they arrive
          if (
            event.type === 'content_block_delta' &&
            event.delta?.type === 'text_delta' &&
            event.delta.text
          ) {
            fullResponse += event.delta.text;
          }
        }

        // Handle complete assistant messages (fallback)
        if (msg.type === 'assistant') {
          const { message } = msg as AgentAssistantMessage;
          if (message?.usage) {
            inputTokens = message.usage.input_tokens ?? inputTokens;
            outputTokens = message.usage.output_tokens ?? outputTokens;
          }
          if (message?.content) {
            const text = message.content
              .filter((b) => b.type === 'text' && b.text)
              .map((b) => b.text)
              .join('');
            if (text) fullResponse = text;
          }
        }

        // Handle result with usage
        if (msg.type === 'result') {
          const result = msg as { usage?: { input_tokens?: number; output_tokens?: number } };
          if (result.usage) {
            inputTokens = result.usage.input_tokens ?? inputTokens;
            outputTokens = result.usage.output_tokens ?? outputTokens;
          }
        }
      }

      // Stage 3: Match modules
      this.sendStatus(job, 'matching_modules');

      const matchedModules = matchModulesInResponse(fullResponse, allModules);

      if (matchedModules.length > 0) {
        this.sendEvent(job, { type: 'modules', modules: matchedModules });
      }

      // Stage 4: Extract code
      this.sendStatus(job, 'generating_code');

      const generatedCode = extractHclCode(fullResponse);

      if (fullResponse) {
        this.sendEvent(job, { type: 'text', content: fullResponse });
      }

      if (generatedCode) {
        this.sendEvent(job, { type: 'code', code: generatedCode });
      }

      // Stage 5: Finalize
      this.sendStatus(job, 'finalizing');

      this.sessions.set(sid, {
        id: sid,
        messages: [...messages, { role: 'assistant', content: fullResponse }],
        matchedModules,
        generatedCode,
        lastAccessedAt: Date.now(),
      });

      this.sendEvent(job, {
        type: 'done',
        sessionId: sid,
        matchedModules,
        generatedCode: generatedCode ?? undefined,
        usage: {
          inputTokens,
          outputTokens,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      const isAuthError =
        reason.includes('authentication_error') ||
        reason.includes('invalid x-api-key') ||
        reason.includes('invalid api key') ||
        reason.includes('credentials');

      if (isAuthError) {
        this.sendEvent(job, {
          type: 'error',
          error:
            'Claude authentication failed. Please run "claude login" or check your credentials file.',
        });
      } else {
        console.error('[TerraformCompose] Pipeline error:', reason);
        this.sendEvent(job, {
          type: 'error',
          error: 'An error occurred during Terraform composition. Please try again.',
        });
      }
    } finally {
      if (session) {
        try {
          session.close();
        } catch {
          // session may already be closed
        }
      }
      this.finishJob(job);
    }
  }

  getSession(sessionId: string): ComposeSession | undefined {
    return this.sessions.get(sessionId);
  }

  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.jobs.delete(sessionId);
  }
}

function formatPrompt(systemPrompt: string, messages: ComposeMessage[]): string {
  const parts: string[] = [systemPrompt, ''];
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    parts.push(`${role}: ${content}`);
  }
  return parts.join('\n\n');
}

function extractHclCode(text: string): string | null {
  const matches = [...text.matchAll(/```hcl\n([\s\S]*?)```/g)]
    .map((m) => m[1]?.trim())
    .filter(Boolean);

  return matches.length > 0 ? matches.join('\n\n') : null;
}

function matchModulesInResponse(response: string, modules: TerraformModule[]): ModuleMatch[] {
  const matched: ModuleMatch[] = [];
  const seen = new Set<string>();
  const responseLower = response.toLowerCase();

  for (const mod of modules) {
    if (seen.has(mod.id)) continue;

    const sourceInResponse = response.includes(mod.source);
    const nameInResponse = responseLower.includes(mod.name.toLowerCase());

    let confidence: number | null = null;
    let matchReason = '';

    if (sourceInResponse) {
      confidence = 1.0;
      matchReason = 'Module source used in generated code';
    } else if (nameInResponse && responseLower.includes(mod.provider.toLowerCase())) {
      confidence = 0.8;
      matchReason = 'Module name and provider referenced in response';
    } else if (nameInResponse) {
      confidence = 0.5;
      matchReason = 'Module name mentioned in response';
    }

    if (confidence !== null) {
      seen.add(mod.id);
      matched.push({
        moduleId: mod.id,
        name: mod.name,
        provider: mod.provider,
        version: mod.version,
        source: mod.source,
        confidence,
        matchReason,
      });
    }
  }

  matched.sort((a, b) => b.confidence - a.confidence);
  return matched;
}
