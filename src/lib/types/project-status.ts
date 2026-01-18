/**
 * Shared types for project status and task counts.
 * Used by both the project service and UI components.
 */

export type ProjectStatus = 'running' | 'idle' | 'needs-approval';

export type TaskCounts = {
  backlog: number;
  queued: number;
  inProgress: number;
  waitingApproval: number;
  verified: number;
  total: number;
};
