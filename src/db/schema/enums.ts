// SQLite doesn't have native enums - use const arrays with type inference
// Validation happens at the application level

export const TASK_COLUMNS = [
  'backlog',
  'queued',
  'in_progress',
  'waiting_approval',
  'verified',
] as const;
export type TaskColumn = (typeof TASK_COLUMNS)[number];

export const AGENT_STATUS = [
  'idle',
  'starting',
  'running',
  'paused',
  'error',
  'completed',
] as const;
export type AgentStatus = (typeof AGENT_STATUS)[number];

export const AGENT_TYPES = ['task', 'conversational', 'background'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const WORKTREE_STATUS = [
  'creating',
  'active',
  'merging',
  'removing',
  'removed',
  'error',
] as const;
export type WorktreeStatus = (typeof WORKTREE_STATUS)[number];

export const TOOL_STATUS = ['pending', 'running', 'complete', 'error'] as const;
export type ToolStatus = (typeof TOOL_STATUS)[number];

export const SESSION_STATUS = [
  'idle',
  'initializing',
  'active',
  'paused',
  'closing',
  'closed',
  'error',
] as const;
export type SessionStatus = (typeof SESSION_STATUS)[number];
