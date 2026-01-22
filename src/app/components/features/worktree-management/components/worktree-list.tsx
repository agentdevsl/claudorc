import { cn } from '@/lib/utils/cn';
import type { WorktreeListProps } from '../types';
import { WorktreeListItem as WorktreeListItemComponent } from './worktree-list-item';

export function WorktreeList({
  worktrees,
  title,
  emptyMessage = 'No worktrees',
  selectedId,
  onSelect,
  onOpen,
  onMerge,
  onCommit,
  onRemove,
  compact = false,
}: WorktreeListProps): React.JSX.Element {
  if (worktrees.length === 0) {
    return <div className="py-4 text-center text-sm text-fg-muted">{emptyMessage}</div>;
  }

  return (
    <div>
      <h3 className={cn('mb-3 font-medium text-fg', compact ? 'text-sm' : 'text-base')}>
        {title} ({worktrees.length})
      </h3>
      <ul className={cn('space-y-2 list-none', compact && 'space-y-1')}>
        {worktrees.map((worktree) => (
          <WorktreeListItemComponent
            key={worktree.id}
            worktree={worktree}
            isSelected={worktree.id === selectedId}
            compact={compact}
            onSelect={() => onSelect?.(worktree)}
            onOpen={() => onOpen?.(worktree)}
            onMerge={() => onMerge?.(worktree)}
            onCommit={() => onCommit?.(worktree)}
            onRemove={() => onRemove?.(worktree)}
          />
        ))}
      </ul>
    </div>
  );
}
