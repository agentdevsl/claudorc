import type { SessionEvent } from '../../../services/session.service.js';
import type {
  PostToolUseHook,
  PostToolUseInput,
  PreToolUseHook,
  PreToolUseInput,
} from '../types.js';

export type AgentStepEvent =
  | {
      type: 'tool:start';
      sessionId: string;
      tool: string;
      input: Record<string, unknown>;
      timestamp: number;
    }
  | {
      type: 'tool:result';
      sessionId: string;
      tool: string;
      input: Record<string, unknown>;
      output: unknown;
      duration: number;
      timestamp: number;
    };

type SessionPublisher = {
  publish: (sessionId: string, event: SessionEvent) => Promise<unknown>;
};

export function createStreamingHooks(
  agentId: string,
  sessionId: string,
  sessionService: SessionPublisher
): { PreToolUse: PreToolUseHook; PostToolUse: PostToolUseHook } {
  return {
    PreToolUse: {
      hooks: [
        async (input: PreToolUseInput): Promise<Record<string, never>> => {
          // Publish tool start event to session
          await sessionService.publish(sessionId, {
            id: crypto.randomUUID(),
            type: 'tool:start',
            timestamp: Date.now(),
            data: {
              agentId,
              tool: input.tool_name,
              input: input.tool_input,
            },
          });

          return {};
        },
      ],
    },

    PostToolUse: {
      hooks: [
        async (input: PostToolUseInput): Promise<Record<string, never>> => {
          // Publish tool completion event
          await sessionService.publish(sessionId, {
            id: crypto.randomUUID(),
            type: 'tool:result',
            timestamp: Date.now(),
            data: {
              agentId,
              tool: input.tool_name,
              input: input.tool_input,
              output: input.tool_response,
              duration: input.duration_ms,
              isError: input.tool_response.is_error ?? false,
            },
          });

          return {};
        },
      ],
    },
  };
}
