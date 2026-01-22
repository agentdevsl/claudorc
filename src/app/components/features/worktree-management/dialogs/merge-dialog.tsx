import { Warning } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { Checkbox } from '@/app/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/app/components/ui/dialog';
import { Skeleton } from '@/app/components/ui/skeleton';
import { Textarea } from '@/app/components/ui/textarea';
import type { MergeDialogProps, MergeOptions } from '../types';
import { formatDiffStats } from '../utils/worktree-helpers';

export function MergeDialog({
  worktree,
  open,
  onOpenChange,
  onMerge,
  isLoading = false,
  diff,
  diffError,
  isDiffLoading = false,
}: MergeDialogProps): React.JSX.Element {
  const [targetBranch, setTargetBranch] = useState(worktree.baseBranch);
  const [deleteAfterMerge, setDeleteAfterMerge] = useState(true);
  const [squash, setSquash] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');

  const handleMerge = () => {
    const options: MergeOptions = {
      targetBranch,
      deleteAfterMerge,
      squash,
      commitMessage: squash ? commitMessage : undefined,
    };
    onMerge(options);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form state when closing
      setTargetBranch(worktree.baseBranch);
      setDeleteAfterMerge(true);
      setSquash(false);
      setCommitMessage('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Merge Worktree</DialogTitle>
          <DialogDescription>
            Merge changes from this worktree into the target branch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Branch info */}
          <div>
            <span className="text-sm font-medium text-fg">Branch</span>
            <p className="mt-1 font-mono text-sm text-accent truncate">{worktree.branch}</p>
          </div>

          {/* Target branch */}
          <div>
            <label htmlFor="target-branch" className="text-sm font-medium text-fg">
              Target Branch
            </label>
            <select
              id="target-branch"
              value={targetBranch}
              onChange={(e) => setTargetBranch(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none"
            >
              <option value={worktree.baseBranch}>{worktree.baseBranch}</option>
              {/* Could add more branches here from API */}
            </select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <span className="block text-sm font-medium text-fg">Options</span>

            <div className="flex items-center gap-2">
              <Checkbox
                id="delete-after-merge"
                checked={deleteAfterMerge}
                onCheckedChange={(checked) => setDeleteAfterMerge(checked === true)}
              />
              <label htmlFor="delete-after-merge" className="text-sm text-fg">
                Delete worktree after merge
              </label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="squash-commits"
                checked={squash}
                onCheckedChange={(checked) => setSquash(checked === true)}
              />
              <label htmlFor="squash-commits" className="text-sm text-fg">
                Squash commits
              </label>
            </div>
          </div>

          {/* Commit message for squash */}
          {squash && (
            <div>
              <label htmlFor="commit-message" className="text-sm font-medium text-fg">
                Commit Message (for squash)
              </label>
              <Textarea
                id="commit-message"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder={worktree.taskTitle ?? 'Merge changes'}
                className="mt-1"
                rows={3}
              />
            </div>
          )}

          {/* Diff summary */}
          {isDiffLoading && (
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-xs text-fg-muted">Changes</p>
              <Skeleton className="mt-1 h-4 w-32" />
            </div>
          )}
          {diffError && (
            <div className="flex items-start gap-2 rounded-md bg-warning/10 p-3">
              <Warning className="h-4 w-4 shrink-0 text-warning" />
              <div>
                <p className="text-xs text-warning">Could not load diff</p>
                <p className="text-xs text-fg-muted">{diffError.message}</p>
              </div>
            </div>
          )}
          {diff && !isDiffLoading && (
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-xs text-fg-muted">Changes</p>
              <p className="text-sm font-medium text-fg">{formatDiffStats(diff.stats)}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isLoading}>
            {isLoading ? 'Merging...' : `Merge to ${targetBranch}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
