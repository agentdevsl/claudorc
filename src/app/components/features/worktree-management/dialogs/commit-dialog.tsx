import { Warning } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '@/app/components/ui/button';
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
import type { CommitDialogProps } from '../types';
import { formatDiffStats, generateCommitMessage } from '../utils/worktree-helpers';

export function CommitDialog({
  worktree,
  open,
  onOpenChange,
  onCommit,
  isLoading = false,
  diff,
  diffError,
  isDiffLoading = false,
}: CommitDialogProps): React.JSX.Element {
  const defaultMessage = generateCommitMessage(worktree.taskTitle, worktree.taskId);
  const [commitMessage, setCommitMessage] = useState(defaultMessage);

  const handleCommit = () => {
    if (commitMessage.trim()) {
      onCommit(commitMessage.trim());
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset form state when closing
      setCommitMessage(defaultMessage);
    }
    onOpenChange(newOpen);
  };

  const isValid = commitMessage.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Commit Changes</DialogTitle>
          <DialogDescription>Commit uncommitted changes in this worktree.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Branch info */}
          <div>
            <span className="text-sm font-medium text-fg">Branch</span>
            <p className="mt-1 font-mono text-sm text-accent truncate">{worktree.branch}</p>
          </div>

          {/* Diff summary */}
          {isDiffLoading && (
            <div className="rounded-md bg-surface-muted p-3">
              <p className="text-xs text-fg-muted">Changes to commit</p>
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
              <p className="text-xs text-fg-muted">Changes to commit</p>
              <p className="text-sm font-medium text-fg">{formatDiffStats(diff.stats)}</p>
              {diff.files.length > 0 && (
                <div className="mt-2 max-h-32 overflow-y-auto">
                  {diff.files.slice(0, 10).map((file) => (
                    <p key={file.path} className="truncate text-xs text-fg-muted">
                      <span
                        className={
                          file.status === 'added'
                            ? 'text-success'
                            : file.status === 'deleted'
                              ? 'text-danger'
                              : 'text-warning'
                        }
                      >
                        {file.status === 'added' ? '+' : file.status === 'deleted' ? '-' : '~'}
                      </span>{' '}
                      {file.path}
                    </p>
                  ))}
                  {diff.files.length > 10 && (
                    <p className="text-xs text-fg-subtle">...and {diff.files.length - 10} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Commit message */}
          <div>
            <label htmlFor="commit-message" className="text-sm font-medium text-fg">
              Commit Message
            </label>
            <Textarea
              id="commit-message"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Describe your changes..."
              className="mt-1"
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleCommit} disabled={isLoading || !isValid}>
            {isLoading ? 'Committing...' : 'Commit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
