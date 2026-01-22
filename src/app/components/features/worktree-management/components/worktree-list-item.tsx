import { GitBranch, Robot, Warning } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';
import type { WorktreeListItemProps } from '../types';
import { formatBranchName, formatRelativeTime } from '../utils/format-worktree';
import { formatAheadBehind } from '../utils/worktree-helpers';
import { WorktreeActions } from './worktree-actions';
import { WorktreeStatusBadge } from './worktree-status-badge';

const itemVariants = cva(
  'relative rounded-md border bg-surface-subtle p-3 transition-all duration-fast ease-out',
  {
    variants: {
      isSelected: {
        true: 'border-accent bg-accent/10',
        false: 'border-border hover:border-fg-subtle hover:bg-surface-muted',
      },
      compact: {
        true: 'p-2',
        false: 'p-3',
      },
    },
    defaultVariants: {
      isSelected: false,
      compact: false,
    },
  }
);

export function WorktreeListItem({
  worktree,
  onSelect,
  onOpen,
  onMerge,
  onCommit,
  onRemove,
  onResolve,
  isSelected = false,
  compact = false,
}: WorktreeListItemProps): React.JSX.Element {
  const isConflict = worktree.displayStatus === 'conflict';
  const branchIcon = isConflict ? (
    <Warning className="h-4 w-4 text-danger" />
  ) : (
    <GitBranch className="h-4 w-4 text-success" />
  );

  if (compact) {
    // Panel mode - compact layout
    return (
      <li
        className={cn(itemVariants({ isSelected, compact: true }), 'list-none')}
        aria-label={`Worktree ${worktree.branch}, status ${worktree.displayStatus}`}
      >
        <button
          type="button"
          className="w-full text-left cursor-pointer bg-transparent border-0 p-0"
          onClick={onSelect}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {branchIcon}
                <span className="truncate font-mono text-xs font-medium text-fg">
                  {formatBranchName(worktree.branch, 25)}
                </span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-fg-muted">
                {worktree.agentName && (
                  <>
                    <Robot className="h-3 w-3" />
                    <span className="truncate">{worktree.agentName}</span>
                    <span className="text-fg-subtle">·</span>
                  </>
                )}
                {worktree.aheadBehind && <span>{formatAheadBehind(worktree.aheadBehind)}</span>}
              </div>
            </div>
            <WorktreeStatusBadge status={worktree.displayStatus} size="sm" />
          </div>
        </button>
      </li>
    );
  }

  // Full mode layout
  return (
    <li
      className={cn(itemVariants({ isSelected, compact: false }), 'list-none')}
      aria-label={`Worktree ${worktree.branch}, status ${worktree.displayStatus}`}
    >
      {/* Clickable header area */}
      <button
        type="button"
        className="w-full text-left cursor-pointer bg-transparent border-0 p-0"
        onClick={onSelect}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {branchIcon}
              <span className="truncate font-mono text-sm font-medium text-accent">
                {formatBranchName(worktree.branch)}
              </span>
            </div>

            {/* Task info */}
            {worktree.taskTitle && (
              <div className="mt-1 text-sm text-fg">
                Task: {worktree.taskTitle}
                {worktree.taskId && (
                  <span className="ml-1 font-mono text-xs text-fg-muted">
                    #{worktree.taskId.slice(0, 7)}
                  </span>
                )}
              </div>
            )}

            {/* Agent info */}
            {worktree.agentName && (
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-fg-muted">
                <Robot className="h-3 w-3" />
                Agent: {worktree.agentName}
              </div>
            )}

            {/* Meta row: ahead/behind, created time */}
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
              {worktree.aheadBehind && (
                <>
                  <span>{formatAheadBehind(worktree.aheadBehind)}</span>
                  <span>from {worktree.baseBranch}</span>
                  <span className="text-fg-subtle">·</span>
                </>
              )}
              {worktree.hasUncommittedChanges && (
                <>
                  <span className="text-warning">Has uncommitted changes</span>
                  <span className="text-fg-subtle">·</span>
                </>
              )}
              <span>Created {formatRelativeTime(worktree.createdAt)}</span>
            </div>
          </div>

          <WorktreeStatusBadge status={worktree.displayStatus} />
        </div>
      </button>

      {/* Actions - outside the button to avoid nested interactive */}
      <div className="mt-3 flex justify-end">
        <WorktreeActions
          worktree={worktree}
          onOpen={onOpen}
          onMerge={onMerge}
          onCommit={onCommit}
          onRemove={onRemove}
          onResolve={onResolve}
        />
      </div>
    </li>
  );
}
