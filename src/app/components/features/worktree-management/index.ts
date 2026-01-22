// Worktree Management - Complete exports

// Sub-components
export { StaleWorktreesSection } from './components/stale-worktrees-section';
export { SummaryCards } from './components/summary-cards';
export { WorktreeActions } from './components/worktree-actions';
export { WorktreeList } from './components/worktree-list';
export { WorktreeListItem } from './components/worktree-list-item';
export { WorktreeStatusBadge } from './components/worktree-status-badge';
// Constants
export {
  AUTO_REFRESH_INTERVAL_MS,
  STALE_THRESHOLD_DAYS,
  STALE_THRESHOLD_MS,
  STATUS_ACTIONS,
  STATUS_CONFIG,
} from './constants';

// Dialogs
export { CommitDialog } from './dialogs/commit-dialog';
export { MergeDialog } from './dialogs/merge-dialog';
export { RemoveDialog } from './dialogs/remove-dialog';

// Hooks
export { useKeyboardShortcuts } from './hooks/use-keyboard-shortcuts';
export { useWorktreeActions } from './hooks/use-worktree-actions';
export { useWorktreeDiff, useWorktrees } from './hooks/use-worktrees';
// Types
export type {
  CommitDialogProps,
  ConflictFile,
  DiffFile,
  DiffStats,
  GitDiff,
  MergeDialogProps,
  MergeOptions,
  RemoveDialogProps,
  StaleWorktreesSectionProps,
  SummaryCardsProps,
  WorktreeActionsProps,
  WorktreeDisplayStatus,
  WorktreeListItem as WorktreeListItemType,
  WorktreeListItemProps,
  WorktreeListProps,
  WorktreeManagementProps,
  WorktreeStatus,
  WorktreeStatusBadgeProps,
} from './types';
// Utilities
export {
  computeDisplayStatus,
  formatBranchName,
  formatRelativeTime,
  groupWorktrees,
  isWorktreeStale,
  transformWorktree,
} from './utils/format-worktree';
export {
  formatAheadBehind,
  formatDiffStats,
  generateCommitMessage,
  getShortBranchName,
  openInEditor,
} from './utils/worktree-helpers';
// Main component
export { WorktreeManagement } from './worktree-management';
