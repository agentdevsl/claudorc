import type { TaskColumn } from '@/db/schema/tasks';

// =============================================================================
// Types
// =============================================================================

export interface ColumnConfig {
  id: TaskColumn;
  label: string;
  title: string;
  accentClass: string;
  indicatorColor: string;
}

export type Priority = 'high' | 'medium' | 'low';

// =============================================================================
// Layout Constants
// =============================================================================

/** Column width in pixels */
export const COLUMN_WIDTH = 280;

/** Rotation angle for drag overlay in degrees */
export const DRAG_ROTATION = 3;

// =============================================================================
// Column Configuration
// =============================================================================

export const COLUMNS: ColumnConfig[] = [
  {
    id: 'backlog',
    label: 'Backlog',
    title: 'Backlog',
    accentClass: 'border-t-[var(--fg-muted)]',
    indicatorColor: 'bg-[var(--fg-muted)]',
  },
  {
    id: 'in_progress',
    label: 'In Progress',
    title: 'In Progress',
    accentClass: 'border-t-[var(--attention-fg)]',
    indicatorColor: 'bg-[var(--attention-fg)]',
  },
  {
    id: 'waiting_approval',
    label: 'Waiting Approval',
    title: 'Waiting Approval',
    accentClass: 'border-t-[var(--accent-fg)]',
    indicatorColor: 'bg-[var(--accent-fg)]',
  },
  {
    id: 'verified',
    label: 'Verified',
    title: 'Verified',
    accentClass: 'border-t-[var(--success-fg)]',
    indicatorColor: 'bg-[var(--success-fg)]',
  },
];

/** Column IDs in display order */
export const COLUMN_ORDER: TaskColumn[] = COLUMNS.map((col) => col.id);

/** Column config indexed by column ID */
export const COLUMN_CONFIG: Record<TaskColumn, { title: string; color: string }> = {
  backlog: { title: 'Backlog', color: 'var(--fg-muted)' },
  in_progress: { title: 'In Progress', color: 'var(--attention-fg)' },
  waiting_approval: { title: 'Waiting Approval', color: 'var(--accent-fg)' },
  verified: { title: 'Verified', color: 'var(--success-fg)' },
};

/** Valid state transitions for workflow enforcement */
export const VALID_TRANSITIONS: Record<TaskColumn, TaskColumn[]> = {
  backlog: ['in_progress'],
  in_progress: ['backlog', 'waiting_approval'],
  waiting_approval: ['in_progress', 'verified'],
  verified: ['backlog'],
};

// =============================================================================
// Priority Configuration
// =============================================================================

export const PRIORITY_CONFIG = {
  high: {
    color: 'bg-[var(--danger-fg)]',
    label: 'High',
  },
  medium: {
    color: 'bg-[var(--attention-fg)]',
    label: 'Medium',
  },
  low: {
    color: 'bg-[var(--success-fg)]',
    label: 'Low',
  },
} as const;

// =============================================================================
// Label Configuration
// =============================================================================

/** Label type mappings for styling */
export const LABEL_TYPES: Record<string, string> = {
  bug: 'bug',
  fix: 'bug',
  error: 'bug',
  feature: 'feature',
  feat: 'feature',
  new: 'feature',
  enhancement: 'enhancement',
  improve: 'enhancement',
  update: 'enhancement',
  docs: 'docs',
  documentation: 'docs',
  doc: 'docs',
  refactor: 'default',
  test: 'default',
  chore: 'default',
};

export const LABEL_COLORS: Record<string, { bg: string; text: string }> = {
  bug: { bg: 'bg-[var(--danger-muted)]', text: 'text-[var(--danger-fg)]' },
  feature: { bg: 'bg-[var(--done-muted)]', text: 'text-[var(--done-fg)]' },
  enhancement: { bg: 'bg-[var(--accent-muted)]', text: 'text-[var(--accent-fg)]' },
  docs: { bg: 'bg-[var(--attention-muted)]', text: 'text-[var(--attention-fg)]' },
  refactor: { bg: 'bg-[var(--secondary-muted)]', text: 'text-[var(--secondary-fg)]' },
  test: { bg: 'bg-[var(--success-muted)]', text: 'text-[var(--success-fg)]' },
  default: { bg: 'bg-[var(--bg-emphasis)]', text: 'text-[var(--fg-muted)]' },
};

// =============================================================================
// Utility Functions
// =============================================================================

export function getLabelColors(label: string): { bg: string; text: string } {
  const lowercaseLabel = label.toLowerCase();
  const colors = LABEL_COLORS[lowercaseLabel];
  if (colors) {
    return colors;
  }
  const defaultColors = LABEL_COLORS.default;
  return defaultColors ?? { bg: 'bg-[var(--bg-emphasis)]', text: 'text-[var(--fg-muted)]' };
}

export function formatTaskId(id: string): string {
  // Extract the last 4 characters or generate a short hash
  const shortId = id.slice(-4).toUpperCase();
  return `#TSK-${shortId}`;
}
