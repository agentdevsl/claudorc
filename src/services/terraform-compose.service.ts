import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import type { TerraformModule } from '../db/schema/terraform.js';
import type { TerraformError } from '../lib/errors/terraform-errors.js';
import { TerraformErrors } from '../lib/errors/terraform-errors.js';
import { buildCompositionSystemPrompt, type ModuleMatch } from '../lib/terraform/compose-prompt.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { TerraformRegistryService } from './terraform-registry.service.js';

export interface ComposeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ComposeSession {
  id: string;
  messages: ComposeMessage[];
  matchedModules: ModuleMatch[];
  generatedCode: string | null;
}

export class TerraformComposeService {
  private sessions = new Map<string, ComposeSession>();

  constructor(private registryService: TerraformRegistryService) {}

  async compose(
    sessionId: string | undefined,
    messages: ComposeMessage[],
    registryId?: string
  ): Promise<Result<ReadableStream<Uint8Array>, TerraformError>> {
    // Get or create session
    const sid = sessionId || createId();

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
    const allModules = modulesResult.ok ? modulesResult.value : [];

    // Create Anthropic client
    const anthropic = new Anthropic();

    try {
      const stream = anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
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
            };
            sessionsMap.set(sid, session);

            controller.close();
          } catch (streamError) {
            const errorMessage =
              streamError instanceof Error ? streamError.message : String(streamError);
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
    // Check if module source or name appears in the response
    const sourceInResponse = response.includes(mod.source);
    const nameInResponse = response.toLowerCase().includes(mod.name.toLowerCase());
    const providerInResponse = response.toLowerCase().includes(mod.provider.toLowerCase());

    if (sourceInResponse) {
      if (!seen.has(mod.id)) {
        seen.add(mod.id);
        matched.push({
          moduleId: mod.id,
          name: mod.name,
          provider: mod.provider,
          version: mod.version,
          source: mod.source,
          confidence: 1.0,
          matchReason: 'Module source used in generated code',
        });
      }
    } else if (nameInResponse && providerInResponse) {
      if (!seen.has(mod.id)) {
        seen.add(mod.id);
        matched.push({
          moduleId: mod.id,
          name: mod.name,
          provider: mod.provider,
          version: mod.version,
          source: mod.source,
          confidence: 0.8,
          matchReason: 'Module name and provider referenced in response',
        });
      }
    } else if (nameInResponse) {
      if (!seen.has(mod.id)) {
        seen.add(mod.id);
        matched.push({
          moduleId: mod.id,
          name: mod.name,
          provider: mod.provider,
          version: mod.version,
          source: mod.source,
          confidence: 0.5,
          matchReason: 'Module name mentioned in response',
        });
      }
    }
  }

  // Sort by confidence descending
  matched.sort((a, b) => b.confidence - a.confidence);

  return matched;
}
