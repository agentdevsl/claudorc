import { pgEnum } from 'drizzle-orm/pg-core';

export const taskColumnEnum = pgEnum('task_column', [
  'backlog',
  'in_progress',
  'waiting_approval',
  'verified',
]);

export const agentStatusEnum = pgEnum('agent_status', [
  'idle',
  'starting',
  'running',
  'paused',
  'error',
  'completed',
]);

export const agentTypeEnum = pgEnum('agent_type', ['task', 'conversational', 'background']);

export const worktreeStatusEnum = pgEnum('worktree_status', [
  'creating',
  'active',
  'merging',
  'removing',
  'removed',
  'error',
]);

export const toolStatusEnum = pgEnum('tool_status', ['pending', 'running', 'complete', 'error']);

export const sessionStatusEnum = pgEnum('session_status', [
  'idle',
  'initializing',
  'active',
  'paused',
  'closing',
  'closed',
  'error',
]);
