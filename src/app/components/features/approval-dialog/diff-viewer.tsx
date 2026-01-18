import { FileCode, FileMinus, FilePlus, FileText } from '@phosphor-icons/react';
import type { DiffFile } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';
import { DiffHunk } from './diff-hunk';

interface DiffViewerProps {
  file: DiffFile | undefined;
}

/**
 * Syntax-highlighted diff display with:
 * - Unified diff format
 * - Line numbers
 * - Syntax highlighting for code
 * - Color-coded additions (green) and deletions (red)
 * - Expandable/collapsible hunks
 */
export function DiffViewer({ file }: DiffViewerProps): React.JSX.Element {
  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-fg-muted">
        <p>No file selected</p>
      </div>
    );
  }

  if (file.hunks.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-fg-muted">
        <FileCode className="h-8 w-8 text-fg-subtle" weight="regular" />
        <p>No changes in this file</p>
      </div>
    );
  }

  const StatusIcon = getStatusIcon(file.status);
  const statusLabel = getStatusLabel(file.status);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* File header */}
      <div className="flex items-center gap-2 border-b border-border bg-surface-muted px-5 py-2">
        <FileCode className="h-3.5 w-3.5 text-fg-subtle" weight="regular" />
        <span className="flex-1 truncate font-mono text-xs text-fg-muted">
          {file.oldPath && file.oldPath !== file.path ? (
            <>
              <span className="text-danger line-through">{file.oldPath}</span>
              <span className="mx-2 text-fg-subtle">&rarr;</span>
              <span>{file.path}</span>
            </>
          ) : (
            file.path
          )}
        </span>
        <span
          className={cn(
            'flex items-center gap-1 text-xs',
            file.status === 'added' && 'text-success',
            file.status === 'modified' && 'text-attention',
            file.status === 'deleted' && 'text-danger',
            file.status === 'renamed' && 'text-accent'
          )}
        >
          <StatusIcon className="h-3 w-3" weight="bold" />
          {statusLabel}
        </span>
      </div>

      {/* Diff content - scrollable */}
      <div className="flex-1 overflow-auto bg-canvas">
        {file.hunks.map((hunk, hunkIndex) => (
          <DiffHunk key={hunkIndex} hunk={hunk} defaultExpanded={true} />
        ))}
      </div>
    </div>
  );
}

function getStatusIcon(
  status: DiffFile['status']
): React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' }> {
  switch (status) {
    case 'added':
      return FilePlus;
    case 'deleted':
      return FileMinus;
    case 'modified':
    case 'renamed':
    default:
      return FileText;
  }
}

function getStatusLabel(status: DiffFile['status']): string {
  switch (status) {
    case 'added':
      return 'new file';
    case 'deleted':
      return 'deleted';
    case 'renamed':
      return 'renamed';
    case 'modified':
    default:
      return 'modified';
  }
}
