import { FileMinus, FilePlus, FileText, Minus, Plus } from '@phosphor-icons/react';
import type { DiffFile, DiffSummary } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';

interface ChangesSummaryProps {
  summary: DiffSummary;
  files: DiffFile[];
}

/**
 * Statistics bar showing:
 * - Total files changed
 * - Lines added (green bar)
 * - Lines deleted (red bar)
 * - Visual proportional bar
 */
export function ChangesSummary({ summary, files }: ChangesSummaryProps): React.JSX.Element {
  const { filesChanged, additions, deletions } = summary;
  const total = additions + deletions;

  // Calculate percentages for the proportional bar
  const additionPercent = total > 0 ? (additions / total) * 100 : 0;
  const deletionPercent = total > 0 ? (deletions / total) * 100 : 0;

  // Count files by status
  const addedFiles = files.filter((f) => f.status === 'added').length;
  const modifiedFiles = files.filter((f) => f.status === 'modified').length;
  const deletedFiles = files.filter((f) => f.status === 'deleted').length;
  const renamedFiles = files.filter((f) => f.status === 'renamed').length;

  return (
    <div className="flex flex-wrap items-center gap-4 border-b border-border bg-surface-subtle px-5 py-3">
      {/* Files changed */}
      <div className="flex items-center gap-1.5 text-sm text-fg-muted">
        <FileText className="h-4 w-4" weight="bold" />
        <span>
          {filesChanged} {filesChanged === 1 ? 'file' : 'files'} changed
        </span>
      </div>

      {/* Lines added */}
      <div className="flex items-center gap-1.5 text-sm text-success">
        <Plus className="h-4 w-4" weight="bold" />
        <span>{additions}</span>
      </div>

      {/* Lines deleted */}
      <div className="flex items-center gap-1.5 text-sm text-danger">
        <Minus className="h-4 w-4" weight="bold" />
        <span>{deletions}</span>
      </div>

      {/* Visual proportional bar */}
      {total > 0 && (
        <div className="flex h-2 w-32 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full bg-success transition-all duration-base ease-out"
            style={{ width: `${additionPercent}%` }}
          />
          <div
            className="h-full bg-danger transition-all duration-base ease-out"
            style={{ width: `${deletionPercent}%` }}
          />
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* File status badges */}
      <div className="flex items-center gap-2">
        {addedFiles > 0 && (
          <Badge variant="success" icon={<FilePlus className="h-3 w-3" weight="bold" />}>
            {addedFiles} added
          </Badge>
        )}
        {modifiedFiles > 0 && (
          <Badge variant="warning" icon={<FileText className="h-3 w-3" weight="bold" />}>
            {modifiedFiles} modified
          </Badge>
        )}
        {deletedFiles > 0 && (
          <Badge variant="danger" icon={<FileMinus className="h-3 w-3" weight="bold" />}>
            {deletedFiles} deleted
          </Badge>
        )}
        {renamedFiles > 0 && (
          <Badge variant="muted" icon={<FileText className="h-3 w-3" weight="bold" />}>
            {renamedFiles} renamed
          </Badge>
        )}
      </div>
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant: 'success' | 'warning' | 'danger' | 'muted';
}

function Badge({ children, icon, variant }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variant === 'success' && 'bg-success-muted/25 text-success',
        variant === 'warning' && 'bg-attention-muted/25 text-attention',
        variant === 'danger' && 'bg-danger-muted/25 text-danger',
        variant === 'muted' && 'bg-surface-muted text-fg-muted'
      )}
    >
      {icon}
      {children}
    </span>
  );
}
