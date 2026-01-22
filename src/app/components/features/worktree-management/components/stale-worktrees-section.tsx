import { CaretDown, CaretRight, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { StaleWorktreesSectionProps } from '../types';
import { WorktreeList } from './worktree-list';

export function StaleWorktreesSection({
  worktrees,
  onPruneAll,
  onRemove,
  isPruning = false,
  compact = false,
}: StaleWorktreesSectionProps): React.JSX.Element | null {
  const [isExpanded, setIsExpanded] = useState(false);

  if (worktrees.length === 0) {
    return null;
  }

  return (
    <div className="rounded-md border border-border bg-surface-subtle">
      {/* Header - always visible */}
      <button
        type="button"
        className="flex w-full items-center justify-between p-3 text-left hover:bg-surface-muted"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <CaretDown className="h-4 w-4 text-fg-muted" />
          ) : (
            <CaretRight className="h-4 w-4 text-fg-muted" />
          )}
          <span className={cn('font-medium text-fg', compact ? 'text-sm' : 'text-base')}>
            Stale Worktrees
          </span>
          <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">
            {worktrees.length}
          </span>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => {
            e.stopPropagation();
            onPruneAll();
          }}
          disabled={isPruning}
          className={cn(compact && 'h-6 px-2 text-xs')}
        >
          <Trash className="mr-1 h-3 w-3" />
          Prune All
        </Button>
      </button>

      {/* Expandable content */}
      {isExpanded && (
        <div className="border-t border-border p-3">
          <p className="mb-3 text-xs text-fg-muted">
            {worktrees.length} worktree{worktrees.length !== 1 ? 's' : ''} inactive for more than 7
            days
          </p>
          <WorktreeList
            worktrees={worktrees}
            title=""
            emptyMessage="No stale worktrees"
            onRemove={onRemove}
            compact={compact}
          />
        </div>
      )}
    </div>
  );
}
