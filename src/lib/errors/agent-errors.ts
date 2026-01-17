import { createError } from './base.js';

export const AgentErrors = {
  NOT_FOUND: createError('AGENT_NOT_FOUND', 'Agent not found', 404),
  ALREADY_RUNNING: (taskId?: string) =>
    createError('AGENT_ALREADY_RUNNING', 'Agent is already running', 409, {
      currentTaskId: taskId,
    }),
  NOT_RUNNING: createError('AGENT_NOT_RUNNING', 'Agent is not running', 400),
  TURN_LIMIT_EXCEEDED: (turns: number, maxTurns: number) =>
    createError(
      'AGENT_TURN_LIMIT_EXCEEDED',
      `Agent completed ${turns} turns (limit: ${maxTurns})`,
      200,
      { turns, maxTurns }
    ),
  NO_AVAILABLE_TASK: createError('AGENT_NO_AVAILABLE_TASK', 'No available tasks for agent', 400),
  TOOL_NOT_ALLOWED: (tool: string, allowed: string[]) =>
    createError('AGENT_TOOL_NOT_ALLOWED', `Tool "${tool}" is not allowed for this agent`, 403, {
      tool,
      allowedTools: allowed,
    }),
  EXECUTION_ERROR: (error: string) =>
    createError('AGENT_EXECUTION_ERROR', `Agent execution failed: ${error}`, 500, {
      error,
    }),
} as const;

export type AgentError =
  | typeof AgentErrors.NOT_FOUND
  | ReturnType<typeof AgentErrors.ALREADY_RUNNING>
  | typeof AgentErrors.NOT_RUNNING
  | ReturnType<typeof AgentErrors.TURN_LIMIT_EXCEEDED>
  | typeof AgentErrors.NO_AVAILABLE_TASK
  | ReturnType<typeof AgentErrors.TOOL_NOT_ALLOWED>
  | ReturnType<typeof AgentErrors.EXECUTION_ERROR>;
