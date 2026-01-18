import type { TaskColumn } from '@/db/schema/tasks';

/**
 * Column configuration with visual styling
 */
export const COLUMN_CONFIG: Record<
  TaskColumn,
  {
    title: string;
    indicatorColor: string;
    bgMuted: string;
  }
> = {
  backlog: {
    title: 'Backlog',
    indicatorColor: '#8b949e',
    bgMuted: 'bg-slate-600',
  },
  queued: {
    title: 'Queued',
    indicatorColor: '#a371f7',
    bgMuted: 'bg-purple-600',
  },
  in_progress: {
    title: 'In Progress',
    indicatorColor: '#d29922',
    bgMuted: 'bg-amber-600',
  },
  waiting_approval: {
    title: 'Waiting Approval',
    indicatorColor: '#58a6ff',
    bgMuted: 'bg-blue-600',
  },
  verified: {
    title: 'Verified',
    indicatorColor: '#3fb950',
    bgMuted: 'bg-green-600',
  },
};

export const COLUMN_ORDER: TaskColumn[] = [
  'backlog',
  'queued',
  'in_progress',
  'waiting_approval',
  'verified',
];

/** Fixed column width in pixels */
export const COLUMN_WIDTH = 300;

/** Drag overlay rotation in degrees */
export const DRAG_ROTATION = 3;

/** Priority configuration */
export const PRIORITY_CONFIG = {
  high: { color: 'bg-danger', label: 'High' },
  medium: { color: 'bg-attention', label: 'Medium' },
  low: { color: 'bg-success', label: 'Low' },
} as const;

export type Priority = keyof typeof PRIORITY_CONFIG;

/** Label type mapping */
export const LABEL_TYPES = {
  bug: 'bug',
  feature: 'feature',
  enhancement: 'enhancement',
  docs: 'docs',
  documentation: 'docs',
} as const;

/**
 * Valid column transitions for drag-and-drop
 * Users can only drag tasks to these allowed destinations
 */
export const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
  backlog: ['queued', 'in_progress'],
  queued: ['backlog', 'in_progress'], // Can be moved back to backlog or start working
  in_progress: ['backlog', 'queued'], // waiting_approval is automatic only
  waiting_approval: ['verified', 'in_progress'],
  verified: [], // Terminal state
};
