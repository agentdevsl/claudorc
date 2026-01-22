import type { DiffStats } from '../types';

/**
 * Format diff stats for display
 */
export function formatDiffStats(stats: DiffStats): string {
  const parts: string[] = [];

  if (stats.filesChanged > 0) {
    parts.push(`${stats.filesChanged} file${stats.filesChanged !== 1 ? 's' : ''} changed`);
  }

  if (stats.additions > 0) {
    parts.push(`+${stats.additions}`);
  }

  if (stats.deletions > 0) {
    parts.push(`-${stats.deletions}`);
  }

  return parts.join(', ') || 'No changes';
}

/**
 * Format ahead/behind counts for display
 */
export function formatAheadBehind(aheadBehind?: { ahead: number; behind: number }): string {
  if (!aheadBehind) return '';

  const parts: string[] = [];

  if (aheadBehind.ahead > 0) {
    parts.push(`↑${aheadBehind.ahead}`);
  }

  if (aheadBehind.behind > 0) {
    parts.push(`↓${aheadBehind.behind}`);
  }

  return parts.join(' ') || 'Up to date';
}

/**
 * Get a short branch name (just the task slug part)
 */
export function getShortBranchName(branch: string): string {
  // Branch format: agent/{id}/{task-slug}
  const parts = branch.split('/');
  if (parts.length >= 3 && parts[0] === 'agent') {
    return parts.slice(2).join('/');
  }
  return branch;
}

/**
 * Open worktree in editor (VS Code)
 */
export function openInEditor(worktreePath: string): void {
  // This would typically be handled by the backend
  // For now, we'll construct a VS Code URL
  const vscodeUrl = `vscode://file/${encodeURIComponent(worktreePath)}`;
  window.open(vscodeUrl, '_blank');
}

/**
 * Generate a default commit message based on task info
 */
export function generateCommitMessage(taskTitle?: string, taskId?: string): string {
  if (taskTitle && taskId) {
    return `${taskTitle} (#${taskId.slice(0, 7)})`;
  }
  if (taskTitle) {
    return taskTitle;
  }
  return 'Work in progress';
}
