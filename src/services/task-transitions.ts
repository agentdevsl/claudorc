import type { TaskColumn } from '../db/schema/tasks.js';

// All columns that tasks can transition to
const ALL_COLUMNS: TaskColumn[] = ['backlog', 'in_progress', 'waiting_approval', 'verified'];

// Allow movement between any columns for flexibility in task management
export const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
  backlog: ALL_COLUMNS.filter((c) => c !== 'backlog'),
  in_progress: ALL_COLUMNS.filter((c) => c !== 'in_progress'),
  waiting_approval: ALL_COLUMNS.filter((c) => c !== 'waiting_approval'),
  verified: ALL_COLUMNS.filter((c) => c !== 'verified'),
};

export const canTransition = (from: TaskColumn, to: TaskColumn): boolean =>
  VALID_TRANSITIONS[from]?.includes(to) ?? false;

export const getValidTransitions = (from: TaskColumn): TaskColumn[] =>
  VALID_TRANSITIONS[from] ?? [];
