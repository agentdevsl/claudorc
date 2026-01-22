import type { WorktreeDisplayStatus } from './types';

// ===== Status Configuration =====
export const STATUS_CONFIG: Record<
  WorktreeDisplayStatus,
  {
    icon: 'spinner' | 'dot' | 'warning' | 'x';
    color: string;
    badgeColor: string;
    textColor: string;
    label: string;
  }
> = {
  creating: {
    icon: 'spinner',
    color: 'text-accent',
    badgeColor: 'bg-accent/15',
    textColor: 'text-accent',
    label: 'Creating',
  },
  initializing: {
    icon: 'spinner',
    color: 'text-accent',
    badgeColor: 'bg-accent/15',
    textColor: 'text-accent',
    label: 'Initializing',
  },
  active: {
    icon: 'dot',
    color: 'text-success',
    badgeColor: 'bg-success/15',
    textColor: 'text-success',
    label: 'Active',
  },
  dirty: {
    icon: 'dot',
    color: 'text-warning',
    badgeColor: 'bg-warning/15',
    textColor: 'text-warning',
    label: 'Dirty',
  },
  committing: {
    icon: 'spinner',
    color: 'text-accent',
    badgeColor: 'bg-accent/15',
    textColor: 'text-accent',
    label: 'Committing',
  },
  merging: {
    icon: 'spinner',
    color: 'text-done',
    badgeColor: 'bg-done/15',
    textColor: 'text-done',
    label: 'Merging',
  },
  conflict: {
    icon: 'warning',
    color: 'text-danger',
    badgeColor: 'bg-danger/15',
    textColor: 'text-danger',
    label: 'Conflict',
  },
  removing: {
    icon: 'spinner',
    color: 'text-fg-muted',
    badgeColor: 'bg-fg-subtle/15',
    textColor: 'text-fg-muted',
    label: 'Removing',
  },
  removed: {
    icon: 'dot',
    color: 'text-fg-muted',
    badgeColor: 'bg-fg-subtle/15',
    textColor: 'text-fg-muted',
    label: 'Removed',
  },
  error: {
    icon: 'x',
    color: 'text-danger',
    badgeColor: 'bg-danger/15',
    textColor: 'text-danger',
    label: 'Error',
  },
};

// ===== Action Button Definitions =====
export type ActionButton = {
  key: string;
  label: string;
  variant: 'default' | 'destructive' | 'outline' | 'ghost';
  action:
    | 'open'
    | 'merge'
    | 'commit'
    | 'remove'
    | 'resolve'
    | 'abort'
    | 'retry'
    | 'cancel'
    | 'force-remove';
};

export const STATUS_ACTIONS: Record<WorktreeDisplayStatus, ActionButton[]> = {
  creating: [{ key: 'cancel', label: 'Cancel', variant: 'ghost', action: 'cancel' }],
  initializing: [{ key: 'cancel', label: 'Cancel', variant: 'ghost', action: 'cancel' }],
  active: [
    { key: 'open', label: 'Open', variant: 'outline', action: 'open' },
    { key: 'merge', label: 'Merge', variant: 'default', action: 'merge' },
    { key: 'remove', label: 'Remove', variant: 'ghost', action: 'remove' },
  ],
  dirty: [
    { key: 'open', label: 'Open', variant: 'outline', action: 'open' },
    { key: 'commit', label: 'Commit', variant: 'default', action: 'commit' },
    { key: 'remove', label: 'Remove', variant: 'ghost', action: 'remove' },
  ],
  committing: [],
  merging: [{ key: 'cancel', label: 'Cancel', variant: 'ghost', action: 'cancel' }],
  conflict: [
    { key: 'open', label: 'Open', variant: 'outline', action: 'open' },
    { key: 'resolve', label: 'Resolve', variant: 'default', action: 'resolve' },
    { key: 'abort', label: 'Abort', variant: 'destructive', action: 'abort' },
  ],
  removing: [],
  removed: [],
  error: [
    { key: 'retry', label: 'Retry', variant: 'default', action: 'retry' },
    { key: 'force-remove', label: 'Force Remove', variant: 'destructive', action: 'force-remove' },
  ],
};

// ===== Stale Threshold =====
export const STALE_THRESHOLD_DAYS = 7;
export const STALE_THRESHOLD_MS = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

// ===== Refresh Interval =====
export const AUTO_REFRESH_INTERVAL_MS = 30_000; // 30 seconds
