import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';
import { createId } from '@paralleldrive/cuid2';
import type { TerraformModule } from '../db/schema/terraform.js';
import type { TerraformError } from '../lib/errors/terraform-errors.js';
import { TerraformErrors } from '../lib/errors/terraform-errors.js';
import { buildCompositionSystemPrompt } from '../lib/terraform/compose-prompt.js';
import type { ComposeMessage, ModuleMatch } from '../lib/terraform/types.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
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

export class TerraformComposeService {
  private sessions = new Map<string, ComposeSession>();

  constructor(private registryService: TerraformRegistryService) {}

  private cleanupSessions(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt > SESSION_TTL_MS) {
        this.sessions.delete(id);
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
      }
    }
  }

  async compose(
    sessionId: string | undefined,
    messages: ComposeMessage[],
    registryId?: string
  ): Promise<Result<ReadableStream<Uint8Array>, TerraformError>> {
    // Use provided session ID or generate a new one (caller must provide full conversation history)
    const sid = sessionId || createId();

    this.cleanupSessions();

    // Get module context
    const contextResult = await this.registryService.getModuleContext(registryId);
    if (!contextResult.ok) {
      return err(contextResult.error);
    }

    const systemPrompt = buildCompositionSystemPrompt(contextResult.value);

    // Get all modules for matching later
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

    // Build a single prompt from system prompt + conversation history for the Agent SDK
    const prompt = formatPromptForAgentSdk(systemPrompt, messages);

    try {
      // Create an Agent SDK session — handles auth via ~/.claude/.credentials.json and env
      const session = unstable_v2_createSession({
        model: 'claude-sonnet-4-20250514',
        env: { ...process.env },
        permissionMode: 'plan', // Read-only, no tool use needed for compose
      });

      await session.send(prompt);

      // Transform Agent SDK stream to SSE stream
      const encoder = new TextEncoder();
      let fullResponse = '';
      const sessionsMap = this.sessions;

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            let usage: { input_tokens?: number; output_tokens?: number } | undefined;

            for await (const msg of session.stream()) {
              // Handle token-by-token streaming
              if (msg.type === 'stream_event') {
                const event = msg.event as {
                  type: string;
                  delta?: { type: string; text?: string };
                };

                if (
                  event.type === 'content_block_delta' &&
                  event.delta?.type === 'text_delta' &&
                  event.delta.text
                ) {
                  fullResponse += event.delta.text;
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ type: 'text', content: event.delta.text })}\n\n`
                    )
                  );
                }
              }

              // Handle result (session finished)
              if (msg.type === 'result') {
                const result = msg as {
                  usage?: { input_tokens?: number; output_tokens?: number };
                };
                usage = result.usage;
              }
            }

            session.close();

            // Extract code blocks and module matches from the full response
            const generatedCode = extractHclCode(fullResponse);
            const matchedModules = matchModulesInResponse(fullResponse, allModules);

            // Send matched modules
            if (matchedModules.length > 0) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'modules', modules: matchedModules })}\n\n`
                )
              );
            }

            // Send generated code
            if (generatedCode) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'code', code: generatedCode })}\n\n`)
              );
            }

            // Send done event
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: 'done',
                  sessionId: sid,
                  matchedModules,
                  generatedCode,
                  usage: usage
                    ? {
                        inputTokens: usage.input_tokens ?? 0,
                        outputTokens: usage.output_tokens ?? 0,
                      }
                    : undefined,
                })}\n\n`
              )
            );

            // Update session
            const composeSession: ComposeSession = {
              id: sid,
              messages: [...messages, { role: 'assistant', content: fullResponse }],
              matchedModules,
              generatedCode,
              lastAccessedAt: Date.now(),
            };
            sessionsMap.set(sid, composeSession);

            controller.close();
          } catch (streamError) {
            session.close();
            const errorMessage =
              streamError instanceof Error ? streamError.message : String(streamError);
            console.error('[TerraformComposeService] Stream error:', errorMessage);

            // Detect authentication errors
            let userMessage = errorMessage;
            const isAuthError =
              errorMessage.includes('authentication_error') ||
              errorMessage.includes('invalid x-api-key') ||
              errorMessage.includes('invalid api key') ||
              errorMessage.includes('credentials');
            if (isAuthError) {
              userMessage =
                'Claude authentication failed. Please run "claude login" or check your credentials file.';
            }

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`)
            );
            controller.close();
          }
        },
      });

      return ok(readable);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return err(TerraformErrors.COMPOSE_FAILED(reason));
    }
  }

  getSession(sessionId: string): ComposeSession | undefined {
    return this.sessions.get(sessionId);
  }

  resetSession(sessionId: string): void {
    this.sessions.delete(sessionId);
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
