import type { Task } from '@/db/schema/tasks';
import type { DiffSummary } from '@/lib/types/diff';

interface ApprovalDialogProps {
  task: Task;
  diff: DiffSummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (commitMessage?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
}

export function ApprovalDialog({
  task,
  diff,
  open,
  onOpenChange,
  onApprove,
  onReject,
}: ApprovalDialogProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-surface p-6">
        <h2 className="text-lg font-semibold text-fg">Review Changes</h2>
        <p className="text-sm text-fg-muted">{task.title}</p>
        {diff && (
          <div className="mt-4 rounded bg-canvas p-3 text-sm">
            <p>
              <span className="text-green-500">+{diff.additions}</span>{' '}
              <span className="text-red-500">-{diff.deletions}</span>{' '}
              <span className="text-fg-muted">in {diff.filesChanged} files</span>
            </p>
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-hover"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
            onClick={() => {
              void onReject('Rejected');
              onOpenChange(false);
            }}
          >
            Reject
          </button>
          <button
            type="button"
            className="rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600"
            onClick={() => {
              void onApprove();
              onOpenChange(false);
            }}
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}
