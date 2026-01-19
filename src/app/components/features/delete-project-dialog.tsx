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
import { TextInput } from '@/app/components/ui/text-input';

interface DeleteProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  onConfirm: () => Promise<void>;
}

export function DeleteProjectDialog({
  open,
  onOpenChange,
  projectName,
  onConfirm,
}: DeleteProjectDialogProps): React.JSX.Element {
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmValid = confirmText === projectName;

  async function handleDelete(): Promise<void> {
    if (!isConfirmValid) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  }

  function handleOpenChange(newOpen: boolean): void {
    if (!newOpen) {
      setConfirmText('');
      setError(null);
    }
    onOpenChange(newOpen);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="delete-project-dialog">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/20">
              <Warning className="h-5 w-5 text-danger" weight="fill" />
            </div>
            <div>
              <DialogTitle>Delete project</DialogTitle>
              <DialogDescription>This action cannot be undone.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          <p className="text-sm text-fg-muted">
            This will permanently delete the project{' '}
            <span className="font-semibold text-fg">{projectName}</span> and all associated data
            including tasks, agents, and sessions.
          </p>

          <div className="rounded-md border border-danger/40 bg-danger/10 p-3">
            <p className="text-sm text-fg">
              Type <span className="font-mono font-semibold">{projectName}</span> to confirm
              deletion.
            </p>
          </div>

          <div className="space-y-2">
            <label
              className="text-xs font-medium uppercase tracking-wide text-fg-muted"
              htmlFor="confirm-delete"
            >
              Project name
            </label>
            <TextInput
              id="confirm-delete"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={projectName}
              data-testid="delete-confirm-input"
              autoFocus
            />
          </div>

          {error && (
            <p className="text-sm text-danger" data-testid="delete-error">
              {error}
            </p>
          )}
        </div>

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmValid || isDeleting}
            data-testid="confirm-delete-button"
          >
            {isDeleting ? 'Deleting...' : 'Delete project'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
