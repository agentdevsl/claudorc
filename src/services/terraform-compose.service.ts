import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import type { TerraformModule } from '../db/schema/terraform.js';
import type { TerraformError } from '../lib/errors/terraform-errors.js';
import { TerraformErrors } from '../lib/errors/terraform-errors.js';
import { buildCompositionSystemPrompt } from '../lib/terraform/compose-prompt.js';
import type { ComposeMessage, ModuleMatch } from '../lib/terraform/types.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { ApiKeyService } from './api-key.service.js';
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

  constructor(
    private registryService: TerraformRegistryService,
    private apiKeyService: ApiKeyService
  ) {}

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

    // Resolve API key: database first, then env var fallback
    let apiKey: string | null = null;
    try {
      apiKey = await this.apiKeyService.getDecryptedKey('anthropic');
    } catch {
      // Fall through to env var
    }
    if (!apiKey) {
      apiKey = process.env.ANTHROPIC_API_KEY ?? null;
    }
    if (!apiKey) {
      return err(
        TerraformErrors.COMPOSE_FAILED(
          'Anthropic API key not configured. Set via Admin Settings or ANTHROPIC_API_KEY environment variable.'
        )
      );
    }

    const anthropic = new Anthropic({ apiKey });

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages,
      });

      // Transform to SSE stream
      const encoder = new TextEncoder();
      let fullResponse = '';
      const sessionsMap = this.sessions;

      const readable = new ReadableStream<Uint8Array>({
        async start(controller) {
          try {
            stream.on('text', (text) => {
              fullResponse += text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', content: text })}\n\n`)
              );
            });

            // Wait for completion
            const finalMessage = await stream.finalMessage();

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
                  usage: {
                    inputTokens: finalMessage.usage.input_tokens,
                    outputTokens: finalMessage.usage.output_tokens,
                  },
                })}\n\n`
              )
            );

            // Update session
            const session: ComposeSession = {
              id: sid,
              messages: [...messages, { role: 'assistant', content: fullResponse }],
              matchedModules,
              generatedCode,
              lastAccessedAt: Date.now(),
            };
            sessionsMap.set(sid, session);

            controller.close();
          } catch (streamError) {
            const errorMessage =
              streamError instanceof Error ? streamError.message : String(streamError);
            console.error('[TerraformComposeService] Stream error:', errorMessage);
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMessage })}\n\n`)
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
