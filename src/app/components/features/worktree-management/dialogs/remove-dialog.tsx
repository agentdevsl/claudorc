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
import type { RemoveDialogProps } from '../types';

export function RemoveDialog({
  worktree,
  open,
  onOpenChange,
  onRemove,
  isLoading = false,
}: RemoveDialogProps): React.JSX.Element {
  const [forceRemove, setForceRemove] = useState(false);

  const handleRemove = () => {
    onRemove(forceRemove);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setForceRemove(false);
    }
    onOpenChange(newOpen);
  };

  const hasUncommittedChanges = worktree.hasUncommittedChanges;
  const requiresForce = hasUncommittedChanges;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Remove Worktree</DialogTitle>
          <DialogDescription>
            This will remove the worktree and delete its branch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Branch info */}
          <div>
            <span className="text-sm font-medium text-fg">Branch</span>
            <p className="mt-1 font-mono text-sm text-accent truncate">{worktree.branch}</p>
          </div>

          {/* Warning for uncommitted changes */}
          {hasUncommittedChanges && (
            <div className="flex items-start gap-3 rounded-md bg-warning/10 p-3">
              <Warning className="h-5 w-5 shrink-0 text-warning" />
              <div>
                <p className="text-sm font-medium text-warning">Uncommitted changes</p>
                <p className="text-xs text-fg-muted">
                  This worktree has uncommitted changes that will be lost if you remove it.
                </p>
              </div>
            </div>
          )}

          {/* Force remove checkbox */}
          {requiresForce && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="force-remove"
                checked={forceRemove}
                onCheckedChange={(checked) => setForceRemove(checked === true)}
              />
              <label htmlFor="force-remove" className="text-sm text-fg">
                Force remove (discard uncommitted changes)
              </label>
            </div>
          )}

          {/* Info about what will be removed */}
          <div className="rounded-md bg-surface-muted p-3 text-xs text-fg-muted">
            <p>This action will:</p>
            <ul className="mt-1 list-inside list-disc space-y-1">
              <li>Remove the worktree directory</li>
              <li>Delete the branch from the repository</li>
              {hasUncommittedChanges && forceRemove && (
                <li className="text-warning">Discard all uncommitted changes</li>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemove}
            disabled={isLoading || (requiresForce && !forceRemove)}
          >
            {isLoading ? 'Removing...' : 'Remove Worktree'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
