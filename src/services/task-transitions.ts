import type { TaskColumn } from '../db/schema/tasks.js';

export const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
  backlog: ['in_progress'],
  in_progress: ['waiting_approval', 'backlog'],
  waiting_approval: ['verified', 'in_progress'],
  verified: [],
};

export const canTransition = (from: TaskColumn, to: TaskColumn): boolean =>
  VALID_TRANSITIONS[from]?.includes(to) ?? false;

export const getValidTransitions = (from: TaskColumn): TaskColumn[] =>
  VALID_TRANSITIONS[from] ?? [];
