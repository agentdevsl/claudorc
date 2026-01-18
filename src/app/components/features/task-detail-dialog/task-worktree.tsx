import { ArrowSquareOut, Copy, Folder, GitBranch } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { Button } from '@/app/components/ui/button';
import type { Worktree, WorktreeStatus } from '@/db/schema/worktrees';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      status: {
        creating: 'bg-attention-muted text-attention',
        active: 'bg-success-muted text-success',
        merging: 'bg-accent-muted text-accent',
        removing: 'bg-danger-muted text-danger',
        removed: 'bg-surface-muted text-fg-muted',
        error: 'bg-danger-muted text-danger',
      },
    },
    defaultVariants: {
      status: 'active',
    },
  }
);

function getStatusLabel(status: WorktreeStatus): string {
  switch (status) {
    case 'creating':
      return 'Creating';
    case 'active':
      return 'Active';
    case 'merging':
      return 'Merging';
    case 'removing':
      return 'Removing';
    case 'removed':
      return 'Removed';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

interface TaskWorktreeProps {
  worktree: Worktree;
}

export function TaskWorktree({ worktree }: TaskWorktreeProps): React.JSX.Element {
  const handleCopyBranch = () => {
    navigator.clipboard.writeText(worktree.branch);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(worktree.path);
  };

  const handleOpenInIDE = () => {
    // Placeholder: Would open in VS Code or configured IDE
    // Using vscode:// protocol or similar
    const vscodeUrl = `vscode://file/${worktree.path}`;
    window.open(vscodeUrl, '_blank');
  };

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Worktree</h3>

      <div className="rounded-md border border-border bg-surface-subtle p-4 space-y-3">
        {/* Branch */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-fg-muted" />
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle block">
                Branch
              </span>
              <span className="font-mono text-sm text-fg">{worktree.branch}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyBranch}
            className="rounded p-1 text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors"
            title="Copy branch name"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {/* Path */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-fg-muted" />
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle block">
                Path
              </span>
              <span className="font-mono text-sm text-fg truncate max-w-[300px] block">
                {worktree.path}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyPath}
            className="rounded p-1 text-fg-muted hover:bg-surface-muted hover:text-fg transition-colors"
            title="Copy path"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        {/* Status and action */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
              Status
            </span>
            <span className={statusBadgeVariants({ status: worktree.status })}>
              {getStatusLabel(worktree.status)}
            </span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenInIDE}
            disabled={worktree.status !== 'active'}
            className="gap-1.5"
          >
            <ArrowSquareOut className="h-3.5 w-3.5" />
            Open in IDE
          </Button>
        </div>
      </div>
    </div>
  );
}
