import type { Agent, AgentConfig, NewAgent } from '../../db/schema/agents.js';
import type { Session } from '../../db/schema/sessions.js';
import type { Task } from '../../db/schema/tasks.js';
import type { Worktree } from '../../db/schema/worktrees.js';
import type { AgentError } from '../../lib/errors/agent-errors.js';
import type { ConcurrencyError } from '../../lib/errors/concurrency-errors.js';
import type { ValidationError } from '../../lib/errors/validation-errors.js';
import type { Result } from '../../lib/utils/result.js';
import type { SessionEvent, SessionWithPresence } from '../session/types.js';

// Re-export schema types for convenience
export type { Agent, AgentConfig, NewAgent };

export type AgentExecutionContext = {
  agentId: string;
  taskId: string;
  projectId: string;
  sessionId: string;
  cwd: string;
  allowedTools: string[];
  maxTurns: number;
  env: Record<string, string>;
};

// Import from stream-handler to avoid duplicate definition
// Re-exported for convenience
export type { AgentRunResult, ExitPlanModeOptions } from '../../lib/agents/stream-handler.js';

export type QueuePosition = {
  taskId: string;
  position: number;
  totalQueued: number;
  estimatedWaitMinutes: number;
  estimatedWaitMs: number;
  estimatedWaitFormatted: string;
};

export type QueueStats = {
  totalQueued: number;
  averageCompletionMs: number;
  recentCompletions: number;
};

export type PreToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
}) => Promise<{ deny?: boolean; reason?: string }>;

export type PostToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}) => Promise<void>;

export type WorktreeService = {
  create: (input: { projectId: string; taskId: string }) => Promise<Result<Worktree, AgentError>>;
};

export type TaskService = {
  moveColumn: (
    taskId: string,
    column: 'in_progress' | 'waiting_approval'
  ) => Promise<Result<unknown, AgentError>>;
};

export type SessionServiceInterface = {
  create: (input: {
    projectId: string;
    taskId?: string;
    agentId?: string;
    title?: string;
  }) => Promise<Result<SessionWithPresence, unknown>>;
  publish: (sessionId: string, event: SessionEvent) => Promise<Result<{ offset: number }, unknown>>;
};

export type AgentStartResult = {
  agent: Agent;
  task: Task;
  session: Session;
  worktree: Worktree;
};

export type AgentServiceError = AgentError | ConcurrencyError | ValidationError;
