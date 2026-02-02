import { query } from '@anthropic-ai/claude-agent-sdk';
import { createId } from '@paralleldrive/cuid2';
import type { TerraformModule } from '../db/schema/terraform.js';
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

export interface ComposeSession {
  id: string;
  messages: ComposeMessage[];
  matchedModules: ModuleMatch[];
  generatedCode: string | null;
  lastAccessedAt: number;
}

/**
 * In-memory event log for a running compose job.
 * Subscribers wait on the `notify` promise which resolves whenever new events arrive.
 */
interface ComposeJob {
  events: ComposeEvent[];
  finished: boolean;
  /** Resolve function to wake up any waiting subscribers */
  notify: () => void;
  /** Promise that subscribers await; replaced after each notification */
  waiting: Promise<void>;
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

    // Create the job event buffer
    let notifyFn: () => void = () => {};
    let waitingPromise = new Promise<void>((resolve) => {
      notifyFn = resolve;
    });

    const job: ComposeJob = {
      events: [],
      finished: false,
      notify: notifyFn,
      waiting: waitingPromise,
    };
    this.jobs.set(sid, job);

    const pushEvent = (event: ComposeEvent) => {
      job.events.push(event);
      // Wake up any waiting subscriber
      job.notify();
      // Create a fresh promise for the next wait
      waitingPromise = new Promise<void>((resolve) => {
        notifyFn = resolve;
      });
      job.waiting = waitingPromise;
      job.notify = notifyFn;
    };

    const pushStatus = (stage: ComposeStage) => {
      pushEvent({ type: 'status', stage });
    };

    // Run the pipeline in the background
    void this.runPipeline(sid, messages, registryId, pushEvent, pushStatus, job);

    return ok({ sessionId: sid });
  }

  /**
   * Subscribe to a compose job's event stream.
   * Returns a ReadableStream of SSE-formatted bytes.
   * The stream replays any buffered events, then waits for new ones.
   */
  subscribeToJob(sessionId: string): ReadableStream<Uint8Array> | null {
    const job = this.jobs.get(sessionId);
    if (!job) return null;

    const encoder = new TextEncoder();
    let cancelled = false;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        let cursor = 0;

        try {
          while (!cancelled) {
            // Drain any buffered events
            while (cursor < job.events.length) {
              if (cancelled) return;
              const event = job.events[cursor++];
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
            }

            // If the job is done, close the stream
            if (job.finished) {
              controller.close();
              return;
            }

            // Capture a local reference to the waiting promise BEFORE checking,
            // to avoid a race where pushEvent replaces job.waiting between
            // the drain loop above and this await.
            const currentWaiting = job.waiting;
            await currentWaiting;
          }
        } catch (err) {
          console.error('[TerraformCompose] Subscriber stream error:', err);
          if (!cancelled) {
            try {
              controller.close();
            } catch {
              // controller may already be closed
            }
          }
        }
      },
      cancel() {
        cancelled = true;
      },
    });
  }

  private async runPipeline(
    sid: string,
    messages: ComposeMessage[],
    registryId: string | undefined,
    pushEvent: (event: ComposeEvent) => void,
    pushStatus: (stage: ComposeStage) => void,
    job: ComposeJob
  ): Promise<void> {
    try {
      // Stage 1: Load module catalog
      pushStatus('loading_catalog');

      const contextResult = await this.registryService.getModuleContext(registryId);
      if (!contextResult.ok) {
        pushEvent({
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

      // Stage 2: Analyzing requirements
      pushStatus('analyzing');

      const prompt = formatPromptForAgentSdk(systemPrompt, messages);

      const q = query({
        prompt,
        options: {
          model: 'claude-sonnet-4-20250514',
          env: { ...process.env },
          permissionMode: 'acceptEdits',
          tools: [],
          maxTurns: 1,
        },
      });

      let fullResponse = '';
      let usage: { input_tokens?: number; output_tokens?: number } | undefined;

      for await (const msg of q) {
        if (msg.type === 'assistant') {
          // biome-ignore lint/suspicious/noExplicitAny: Agent SDK message type lacks typed `message` field
          const assistantMsg = (msg as any).message as {
            content?: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
          };

          if (assistantMsg.usage) {
            usage = assistantMsg.usage;
          }

          if (assistantMsg.content) {
            fullResponse = assistantMsg.content
              .filter((b) => b.type === 'text' && b.text)
              .map((b) => b.text)
              .join('');
          }

          break;
        }

        if (msg.type === 'result') {
          const result = msg as {
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          if (result.usage) usage = result.usage;
          break;
        }
      }

      q.close();

      // Stage 3: Match modules
      pushStatus('matching_modules');

      const matchedModules = matchModulesInResponse(fullResponse, allModules);

      if (matchedModules.length > 0) {
        pushEvent({ type: 'modules', modules: matchedModules });
      }

      // Stage 4: Extract code
      pushStatus('generating_code');

      const generatedCode = extractHclCode(fullResponse);

      if (fullResponse) {
        pushEvent({ type: 'text', content: fullResponse });
      }

      if (generatedCode) {
        pushEvent({ type: 'code', code: generatedCode });
      }

      // Stage 5: Finalize
      pushStatus('finalizing');

      this.sessions.set(sid, {
        id: sid,
        messages: [...messages, { role: 'assistant', content: fullResponse }],
        matchedModules,
        generatedCode,
        lastAccessedAt: Date.now(),
      });

      pushEvent({
        type: 'done',
        sessionId: sid,
        matchedModules,
        generatedCode: generatedCode ?? undefined,
        usage: usage
          ? {
              inputTokens: usage.input_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
            }
          : { inputTokens: 0, outputTokens: 0 },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      const isAuthError =
        reason.includes('authentication_error') ||
        reason.includes('invalid x-api-key') ||
        reason.includes('invalid api key') ||
        reason.includes('credentials');

      if (isAuthError) {
        pushEvent({
          type: 'error',
          error:
            'Claude authentication failed. Please run "claude login" or check your credentials file.',
        });
      } else {
        pushEvent({ type: 'error', error: reason });
      }
    } finally {
      job.finished = true;
      // Final notification to wake any subscriber so it sees finished=true
      job.notify();
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

function formatPromptForAgentSdk(systemPrompt: string, messages: ComposeMessage[]): string {
  const parts: string[] = [systemPrompt, ''];
  for (const msg of messages) {
    const role = msg.role === 'user' ? 'User' : 'Assistant';
    const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
    parts.push(`${role}: ${content}`);
  }
  return parts.join('\n\n');
}

function extractHclCode(text: string): string | null {
  const hclRegex = /```hcl\n([\s\S]*?)```/g;
  const matches: string[] = [];
  let match: RegExpExecArray | null = hclRegex.exec(text);

  while (match !== null) {
    if (match[1]) {
      matches.push(match[1].trim());
    }
    match = hclRegex.exec(text);
  }

  if (matches.length === 0) return null;
  return matches.join('\n\n');
}

function matchModulesInResponse(response: string, modules: TerraformModule[]): ModuleMatch[] {
  const matched: ModuleMatch[] = [];
  const seen = new Set<string>();

  for (const mod of modules) {
    if (seen.has(mod.id)) continue;

    const sourceInResponse = response.includes(mod.source);
    const nameInResponse = response.toLowerCase().includes(mod.name.toLowerCase());

    let confidence: number | null = null;
    let matchReason = '';

    if (sourceInResponse) {
      confidence = 1.0;
      matchReason = 'Module source used in generated code';
    } else if (nameInResponse && response.toLowerCase().includes(mod.provider.toLowerCase())) {
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
