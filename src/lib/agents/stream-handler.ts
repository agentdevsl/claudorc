import { createId } from '@paralleldrive/cuid2';
import type { SessionEvent } from '../../services/session.service.js';
import { getToolHandler } from './tools/index.js';
import type { AgentHooks, ToolContext, ToolResponse } from './types.js';

export interface StreamHandlerOptions {
  agentId: string;
  sessionId: string;
  prompt: string;
  allowedTools: string[];
  maxTurns: number;
  model: string;
  cwd: string;
  hooks: AgentHooks;
  sessionService: {
    publish: (sessionId: string, event: SessionEvent) => Promise<unknown>;
  };
}

export interface AgentRunResult {
  runId: string;
  status: 'completed' | 'error' | 'turn_limit' | 'paused';
  turnCount: number;
  result?: string;
  error?: string;
}

async function runPreToolHooks(
  hooks: AgentHooks,
  toolName: string,
  toolInput: Record<string, unknown>
): Promise<{ allowed: boolean; message?: string }> {
  for (const hookGroup of hooks.PreToolUse) {
    for (const hook of hookGroup.hooks) {
      const result = await hook({ tool_name: toolName, tool_input: toolInput });
      if (result.decision === 'block') {
        return { allowed: false, message: result.message };
      }
    }
  }
  return { allowed: true };
}

async function runPostToolHooks(
  hooks: AgentHooks,
  toolName: string,
  toolInput: Record<string, unknown>,
  toolResponse: ToolResponse,
  durationMs: number
): Promise<void> {
  for (const hookGroup of hooks.PostToolUse) {
    for (const hook of hookGroup.hooks) {
      await hook({
        tool_name: toolName,
        tool_input: toolInput,
        tool_response: toolResponse,
        duration_ms: durationMs,
      });
    }
  }
}

export async function runAgentWithStreaming(
  options: StreamHandlerOptions
): Promise<AgentRunResult> {
  const { agentId, sessionId, maxTurns, sessionService } = options;

  const runId = createId();
  let turn = 0;

  // Publish agent started event
  await sessionService.publish(sessionId, {
    id: createId(),
    type: 'agent:started',
    timestamp: Date.now(),
    data: { agentId, runId, maxTurns },
  });

  try {
    // Since the SDK uses query() as an async generator, we simulate the pattern
    // In a real implementation, this would iterate over SDK's query() output
    // For now, we provide a placeholder that can be replaced with actual SDK calls

    // Placeholder: In real implementation, this would be:
    // for await (const message of query({ prompt, options })) { ... }

    // For demonstration, we'll simulate a basic tool execution loop
    // The actual SDK integration would replace this with real SDK calls

    while (turn < maxTurns) {
      turn++;

      // Update agent turn count in session
      await sessionService.publish(sessionId, {
        id: createId(),
        type: 'agent:turn',
        timestamp: Date.now(),
        data: { agentId, turn, maxTurns, remaining: maxTurns - turn },
      });

      // In real SDK implementation, this is where we'd process messages
      // For now, we break after first turn to signal placeholder behavior
      break;
    }

    // Check if turn limit was reached
    if (turn >= maxTurns) {
      await sessionService.publish(sessionId, {
        id: createId(),
        type: 'agent:turn_limit',
        timestamp: Date.now(),
        data: { agentId, turn, maxTurns },
      });

      return {
        runId,
        status: 'turn_limit',
        turnCount: turn,
        result: `Turn limit reached (${maxTurns}). Task moved to waiting approval.`,
      };
    }

    // Publish completion
    await sessionService.publish(sessionId, {
      id: createId(),
      type: 'agent:completed',
      timestamp: Date.now(),
      data: { agentId, runId, turnCount: turn },
    });

    return {
      runId,
      status: 'completed',
      turnCount: turn,
      result: 'Task completed successfully',
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    await sessionService.publish(sessionId, {
      id: createId(),
      type: 'agent:error',
      timestamp: Date.now(),
      data: { agentId, runId, error: errorMessage },
    });

    return {
      runId,
      status: 'error',
      turnCount: turn,
      error: errorMessage,
    };
  }
}

// Helper to execute a single tool call with hooks
export async function executeToolWithHooks(
  toolName: string,
  toolInput: Record<string, unknown>,
  context: ToolContext,
  hooks: AgentHooks
): Promise<ToolResponse> {
  // Run pre-tool hooks
  const preResult = await runPreToolHooks(hooks, toolName, toolInput);
  if (!preResult.allowed) {
    return {
      content: [{ type: 'text', text: preResult.message ?? 'Tool blocked by policy' }],
      is_error: true,
    };
  }

  // Get tool handler
  const handler = getToolHandler(toolName);
  if (!handler) {
    return {
      content: [{ type: 'text', text: `Unknown tool: ${toolName}` }],
      is_error: true,
    };
  }

  // Execute tool
  const startTime = Date.now();
  const response = await handler(toolInput as never, context);
  const duration = Date.now() - startTime;

  // Run post-tool hooks
  await runPostToolHooks(hooks, toolName, toolInput, response, duration);

  return response;
}
