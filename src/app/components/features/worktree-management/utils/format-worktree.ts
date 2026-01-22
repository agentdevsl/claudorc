import { STALE_THRESHOLD_MS } from '../constants';
import type { WorktreeDisplayStatus, WorktreeListItem } from '../types';

/**
 * Format a branch name for display (truncate the agent prefix)
 */
export function formatBranchName(branch: string, maxLength = 40): string {
  // Branch format: agent/{id}/{task-slug}
  // Show shortened version: agent/.../task-slug
  const parts = branch.split('/');
  if (parts.length >= 3 && parts[0] === 'agent') {
    const taskSlug = parts.slice(2).join('/');
    if (branch.length > maxLength) {
      return `agent/.../${taskSlug}`;
    }
  }
  return branch.length > maxLength ? `${branch.slice(0, maxLength - 3)}...` : branch;
}

/**
 * Format relative time for display
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Check if a worktree is stale (inactive for more than threshold)
 */
export function isWorktreeStale(worktree: {
  updatedAt: string | null;
  createdAt: string;
}): boolean {
  const lastActivity = worktree.updatedAt ?? worktree.createdAt;
  const lastActivityDate = new Date(lastActivity);
  const now = new Date();
  return now.getTime() - lastActivityDate.getTime() > STALE_THRESHOLD_MS;
}

/**
 * Compute display status from worktree data
 */
export function computeDisplayStatus(
  status: string,
  hasUncommittedChanges: boolean
): WorktreeDisplayStatus {
  // If active but has uncommitted changes, show as dirty
  if (status === 'active' && hasUncommittedChanges) {
    return 'dirty';
  }
  return status as WorktreeDisplayStatus;
}

/**
 * Transform raw API worktree to WorktreeListItem
 */
export function transformWorktree(raw: {
  id: string;
  branch: string;
  path: string;
  baseBranch: string;
  status: string;
  taskId: string | null;
  taskTitle?: string;
  agentId?: string;
  agentName?: string;
  createdAt: string;
  updatedAt: string | null;
  hasUncommittedChanges?: boolean;
  aheadBehind?: { ahead: number; behind: number };
}): WorktreeListItem {
  const hasUncommittedChanges = raw.hasUncommittedChanges ?? false;

  return {
    id: raw.id,
    branch: raw.branch,
    path: raw.path,
    baseBranch: raw.baseBranch,
    status: raw.status as WorktreeListItem['status'],
    displayStatus: computeDisplayStatus(raw.status, hasUncommittedChanges),
    taskId: raw.taskId ?? undefined,
    taskTitle: raw.taskTitle,
    agentId: raw.agentId,
    agentName: raw.agentName,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    lastActivity: raw.updatedAt ?? raw.createdAt,
    hasUncommittedChanges,
    aheadBehind: raw.aheadBehind,
    isStale: isWorktreeStale({ updatedAt: raw.updatedAt, createdAt: raw.createdAt }),
  };
}

/**
 * Separate worktrees into active and stale groups
 */
export function groupWorktrees(worktrees: WorktreeListItem[]): {
  active: WorktreeListItem[];
  stale: WorktreeListItem[];
} {
  const active: WorktreeListItem[] = [];
  const stale: WorktreeListItem[] = [];

  for (const wt of worktrees) {
    // Don't show removed worktrees
    if (wt.status === 'removed') continue;

    if (wt.isStale) {
      stale.push(wt);
    } else {
      active.push(wt);
    }
  }

  return { active, stale };
}
