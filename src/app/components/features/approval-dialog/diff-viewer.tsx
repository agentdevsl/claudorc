import {
  ArrowRight,
  FileCode,
  FileMinus,
  FilePlus,
  FileText,
  PencilSimple,
} from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import type { DiffFile, DiffFileStatus } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';
import { DiffHunk } from './diff-hunk';

/**
 * CVA variants for file status badges
 */
const fileStatusVariants = cva('flex items-center gap-1 text-xs font-medium', {
  variants: {
    status: {
      added: 'text-[var(--syntax-added)]',
      modified: 'text-attention',
      deleted: 'text-[var(--syntax-removed)]',
      renamed: 'text-accent',
    },
  },
  defaultVariants: {
    status: 'modified',
  },
});

interface DiffViewerProps {
  file: DiffFile | undefined;
  showHeader?: boolean;
}

/**
 * Syntax-highlighted diff display with:
 * - Unified diff format
 * - Line numbers
 * - Syntax highlighting for code
 * - Color-coded additions (green) and deletions (red)
 * - Expandable/collapsible hunks
 */
export function DiffViewer({ file, showHeader = true }: DiffViewerProps): React.JSX.Element {
  if (!file) {
    return (
      <div
        className="flex flex-1 items-center justify-center p-8 text-fg-muted"
        data-testid="diff-viewer-empty"
      >
        <p>No file selected</p>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="flex flex-1 flex-col" data-testid="diff-viewer-binary">
        {showHeader && <DiffFileHeader file={file} />}
        <div className="flex flex-1 items-center justify-center gap-2 p-8 text-fg-muted">
          <FileCode className="h-8 w-8 text-fg-subtle" weight="regular" />
          <p>Binary file not shown</p>
        </div>
      </div>
    );
  }

  if (file.hunks.length === 0) {
    return (
      <div
        className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-fg-muted"
        data-testid="diff-viewer-no-changes"
      >
        <FileCode className="h-8 w-8 text-fg-subtle" weight="regular" />
        <p>No changes in this file</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="diff-viewer">
      {/* File header */}
      {showHeader && <DiffFileHeader file={file} />}

      {/* Diff content - scrollable */}
      <div className="flex-1 overflow-auto bg-canvas">
        {file.hunks.map((hunk, hunkIndex) => (
          <DiffHunk key={hunkIndex} hunk={hunk} defaultExpanded={true} />
        ))}
      </div>
    </div>
  );
}

/**
 * File header component showing path, rename info, and status
 */
function DiffFileHeader({ file }: { file: DiffFile }): React.JSX.Element {
  const StatusIcon = getStatusIcon(file.status);
  const statusLabel = getStatusLabel(file.status);

  return (
    <div
      className="flex items-center gap-2 border-b border-border bg-surface-muted px-5 py-2"
      data-testid="diff-file-header"
    >
      {/* File icon */}
      <FileCode className="h-3.5 w-3.5 shrink-0 text-fg-subtle" weight="regular" />

      {/* File path(s) */}
      <span className="flex-1 truncate font-mono text-xs text-fg-muted">
        {file.oldPath && file.oldPath !== file.path ? (
          <span className="flex items-center gap-2">
            <span className="text-[var(--syntax-removed)] line-through">{file.oldPath}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-fg-subtle" weight="bold" />
            <span className="text-fg">{file.path}</span>
          </span>
        ) : (
          file.path
        )}
      </span>

      {/* Change counts */}
      <span className="flex shrink-0 items-center gap-2 text-xs">
        {file.additions > 0 && (
          <span className="text-[var(--syntax-added)]" data-testid="file-additions">
            +{file.additions}
          </span>
        )}
        {file.deletions > 0 && (
          <span className="text-[var(--syntax-removed)]" data-testid="file-deletions">
            -{file.deletions}
          </span>
        )}
      </span>

      {/* Status badge */}
      <span className={fileStatusVariants({ status: file.status })} data-testid="file-status">
        <StatusIcon className="h-3 w-3" weight="bold" />
        {statusLabel}
      </span>
    </div>
  );
}

/**
 * Get the appropriate icon component for file status
 */
function getStatusIcon(
  status: DiffFileStatus
): React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' }> {
  switch (status) {
    case 'added':
      return FilePlus;
    case 'deleted':
      return FileMinus;
    case 'renamed':
      return PencilSimple;
    default:
      return FileText;
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: DiffFileStatus): string {
  switch (status) {
    case 'added':
      return 'new file';
    case 'deleted':
      return 'deleted';
    case 'renamed':
      return 'renamed';
    default:
      return 'modified';
  }
}

/**
 * Expandable diff viewer that starts collapsed for large files
 */
export function CollapsibleDiffViewer({
  file,
  maxLinesBeforeCollapse = 100,
}: {
  file: DiffFile;
  maxLinesBeforeCollapse?: number;
}): React.JSX.Element {
  const totalLines = file.hunks.reduce((sum, hunk) => sum + hunk.lines.length, 0);
  const shouldStartCollapsed = totalLines > maxLinesBeforeCollapse;

  return (
    <div className="flex flex-1 flex-col overflow-hidden" data-testid="collapsible-diff-viewer">
      <DiffFileHeader file={file} />
      <div className="flex-1 overflow-auto bg-canvas">
        {file.hunks.map((hunk, hunkIndex) => (
          <DiffHunk key={hunkIndex} hunk={hunk} defaultExpanded={!shouldStartCollapsed} />
        ))}
      </div>
    </div>
  );
}

/**
 * Multi-file diff viewer that renders all files in sequence
 */
export function MultiFileDiffViewer({
  files,
  className,
}: {
  files: DiffFile[];
  className?: string;
}): React.JSX.Element {
  if (files.length === 0) {
    return (
      <div
        className={cn('flex flex-1 items-center justify-center p-8 text-fg-muted', className)}
        data-testid="multi-file-diff-empty"
      >
        <p>No files to display</p>
      </div>
    );
  }

  return (
    <div
      className={cn('flex flex-1 flex-col overflow-auto', className)}
      data-testid="multi-file-diff"
    >
      {files.map((file) => (
        <div key={file.path} className="border-b border-border last:border-b-0">
          <DiffViewer file={file} showHeader={true} />
        </div>
      ))}
    </div>
  );
}
