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

/**
 * Creates a unique key for tracking in-flight tool calls.
 * Uses tool name + stringified input to match PreToolUse with PostToolUse.
 */
function createToolCallKey(toolName: string, toolInput: Record<string, unknown>): string {
  try {
    return `${toolName}:${JSON.stringify(toolInput)}`;
  } catch {
    // Fallback if input can't be stringified
    return `${toolName}:${Date.now()}`;
  }
}

export function createStreamingHooks(
  agentId: string,
  sessionId: string,
  sessionService: SessionPublisher
): { PreToolUse: PreToolUseHook; PostToolUse: PostToolUseHook } {
  // Track in-flight tool calls to pair start/result events
  const inFlightToolCalls = new Map<string, string>();

  return {
    PreToolUse: {
      hooks: [
        async (input: PreToolUseInput): Promise<Record<string, never>> => {
          // Generate a unique ID for this tool call
          const toolCallId = crypto.randomUUID();
          const toolCallKey = createToolCallKey(input.tool_name, input.tool_input);

          // Store the toolCallId for pairing with PostToolUse
          inFlightToolCalls.set(toolCallKey, toolCallId);

          // Publish tool start event to session
          await sessionService.publish(sessionId, {
            id: crypto.randomUUID(),
            type: 'tool:start',
            timestamp: Date.now(),
            data: {
              id: toolCallId,
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
          // Retrieve the toolCallId from the matching PreToolUse
          const toolCallKey = createToolCallKey(input.tool_name, input.tool_input);
          const toolCallId = inFlightToolCalls.get(toolCallKey) ?? crypto.randomUUID();

          // Clean up the in-flight tracking
          inFlightToolCalls.delete(toolCallKey);

          // Publish tool completion event
          await sessionService.publish(sessionId, {
            id: crypto.randomUUID(),
            type: 'tool:result',
            timestamp: Date.now(),
            data: {
              id: toolCallId,
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
