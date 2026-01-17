import { GitBranch, Trash } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { WorktreeStatusInfo } from '@/services/worktree.service';

interface WorktreeManagementProps {
  worktrees: WorktreeStatusInfo[];
  onRemove: (worktreeId: string) => Promise<void>;
}

const statusLabel: Record<WorktreeStatusInfo['status'], string> = {
  active: 'Active',
  creating: 'Creating',
  merging: 'Merging',
  removing: 'Removing',
  removed: 'Removed',
  error: 'Error',
};

const statusTone: Record<WorktreeStatusInfo['status'], string> = {
  active: 'text-success',
  creating: 'text-fg-muted',
  merging: 'text-attention',
  removing: 'text-attention',
  removed: 'text-fg-muted',
  error: 'text-danger',
};

export function WorktreeManagement({
  worktrees,
  onRemove,
}: WorktreeManagementProps): React.JSX.Element {
  const [removing, setRemoving] = useState<string | null>(null);

  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-muted">
          <GitBranch className="h-5 w-5 text-fg-muted" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-fg">Worktrees</h2>
          <p className="text-sm text-fg-muted">Manage active branches and clean up stale work.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {worktrees.length === 0 ? (
          <p className="text-sm text-fg-muted">No worktrees yet.</p>
        ) : (
          worktrees.map((worktree) => (
            <div
              key={worktree.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle p-3"
            >
              <div>
                <p className="text-sm font-medium text-fg">{worktree.branch}</p>
                <p className="text-xs text-fg-muted truncate">{worktree.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-xs font-medium', statusTone[worktree.status])}>
                  {statusLabel[worktree.status]}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRemoving(worktree.id);
                    void onRemove(worktree.id).finally(() => setRemoving(null));
                  }}
                  disabled={removing === worktree.id}
                >
                  <Trash className="h-3 w-3" />
                  Remove
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
