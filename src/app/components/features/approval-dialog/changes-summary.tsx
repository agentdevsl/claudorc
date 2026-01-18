import { FileMinus, FilePlus, FileText, Minus, PencilSimple, Plus } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import type { DiffFile, DiffSummary } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';

/**
 * CVA variants for status badges
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        success: 'bg-[var(--syntax-added)]/15 text-[var(--syntax-added)]',
        warning: 'bg-attention-muted/25 text-attention',
        danger: 'bg-[var(--syntax-removed)]/15 text-[var(--syntax-removed)]',
        muted: 'bg-surface-muted text-fg-muted',
        accent: 'bg-accent-muted/25 text-accent',
      },
    },
    defaultVariants: {
      variant: 'muted',
    },
  }
);

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
    <div
      className="flex flex-wrap items-center gap-4 border-b border-border bg-surface-subtle px-5 py-3"
      data-testid="changes-summary"
    >
      {/* Files changed */}
      <div className="flex items-center gap-1.5 text-sm text-fg-muted">
        <FileText className="h-4 w-4" weight="bold" />
        <span>
          {filesChanged} {filesChanged === 1 ? 'file' : 'files'} changed
        </span>
      </div>

      {/* Lines added */}
      <div className="flex items-center gap-1.5 text-sm text-[var(--syntax-added)]">
        <Plus className="h-4 w-4" weight="bold" />
        <span data-testid="total-additions">{additions}</span>
      </div>

      {/* Lines deleted */}
      <div className="flex items-center gap-1.5 text-sm text-[var(--syntax-removed)]">
        <Minus className="h-4 w-4" weight="bold" />
        <span data-testid="total-deletions">{deletions}</span>
      </div>

      {/* Visual proportional bar */}
      {total > 0 && (
        <ProportionalBar
          additionPercent={additionPercent}
          deletionPercent={deletionPercent}
          additions={additions}
          deletions={deletions}
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* File status badges */}
      <div className="flex items-center gap-2" data-testid="file-status-badges">
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
          <Badge variant="accent" icon={<PencilSimple className="h-3 w-3" weight="bold" />}>
            {renamedFiles} renamed
          </Badge>
        )}
      </div>
    </div>
  );
}

interface ProportionalBarProps {
  additionPercent: number;
  deletionPercent: number;
  additions: number;
  deletions: number;
}

/**
 * Visual bar showing proportion of additions vs deletions
 */
function ProportionalBar({
  additionPercent,
  deletionPercent,
  additions,
  deletions,
}: ProportionalBarProps): React.JSX.Element {
  return (
    <div
      className="flex h-2 w-32 overflow-hidden rounded-full bg-surface-muted"
      title={`+${additions} additions, -${deletions} deletions`}
      role="img"
      aria-label={`${Math.round(additionPercent)}% additions, ${Math.round(deletionPercent)}% deletions`}
      data-testid="proportional-bar"
    >
      <div
        className="h-full bg-[var(--syntax-added)] transition-all duration-base ease-out"
        style={{ width: `${additionPercent}%` }}
        data-testid="additions-bar"
      />
      <div
        className="h-full bg-[var(--syntax-removed)] transition-all duration-base ease-out"
        style={{ width: `${deletionPercent}%` }}
        data-testid="deletions-bar"
      />
    </div>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
  variant: 'success' | 'warning' | 'danger' | 'muted' | 'accent';
}

/**
 * Status badge component with icon support
 */
function Badge({ children, icon, variant }: BadgeProps): React.JSX.Element {
  return (
    <span className={badgeVariants({ variant })} data-testid={`badge-${variant}`}>
      {icon}
      {children}
    </span>
  );
}

/**
 * Compact version for smaller spaces
 */
export function CompactChangesSummary({ summary }: { summary: DiffSummary }): React.JSX.Element {
  const { filesChanged, additions, deletions } = summary;

  return (
    <div className="flex items-center gap-3 text-xs" data-testid="compact-changes-summary">
      <span className="text-fg-muted">{filesChanged} files</span>
      <span className="text-[var(--syntax-added)]">+{additions}</span>
      <span className="text-[var(--syntax-removed)]">-{deletions}</span>
    </div>
  );
}

/**
 * Inline changes display for headers or cards
 */
export function InlineChanges({
  additions,
  deletions,
  className,
}: {
  additions: number;
  deletions: number;
  className?: string;
}): React.JSX.Element {
  return (
    <span className={cn('inline-flex items-center gap-2 text-xs', className)}>
      {additions > 0 && (
        <span className="text-[var(--syntax-added)]" data-testid="inline-additions">
          +{additions}
        </span>
      )}
      {deletions > 0 && (
        <span className="text-[var(--syntax-removed)]" data-testid="inline-deletions">
          -{deletions}
        </span>
      )}
    </span>
  );
}
