import {
  FileCode,
  FileCss,
  FileHtml,
  FileJs,
  FileMd,
  FileMinus,
  FilePlus,
  FileText,
  FileTs,
} from '@phosphor-icons/react';
import { useEffect, useRef } from 'react';
import type { DiffFile, DiffFileStatus } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';

interface FileTabsProps {
  files: DiffFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Per-file navigation with:
 * - Tab for each changed file
 * - File icons based on extension
 * - Change count per file (+/-)
 * - Scrollable tab list for many files
 */
export function FileTabs({ files, activeIndex, onSelect }: FileTabsProps): React.JSX.Element {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll to active tab when it changes
  useEffect(() => {
    if (activeTabRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const tab = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();

      if (tabRect.left < containerRect.left) {
        container.scrollLeft -= containerRect.left - tabRect.left + 16;
      } else if (tabRect.right > containerRect.right) {
        container.scrollLeft += tabRect.right - containerRect.right + 16;
      }
    }
  }, [activeIndex]);

  return (
    <div
      ref={scrollContainerRef}
      className="flex gap-0 overflow-x-auto border-b border-border bg-surface-subtle scrollbar-thin scrollbar-track-transparent scrollbar-thumb-border"
    >
      {files.map((file, index) => {
        const isActive = index === activeIndex;
        const fileName = file.path.split('/').pop() || file.path;
        const Icon = getFileIcon(file.path);
        const StatusIcon = getStatusIcon(file.status);

        return (
          <button
            key={file.path}
            ref={isActive ? activeTabRef : undefined}
            type="button"
            onClick={() => onSelect(index)}
            className={cn(
              'group relative flex shrink-0 items-center gap-2 px-4 py-2.5 text-[13px] font-mono transition duration-fast ease-out',
              'whitespace-nowrap border-b-2',
              isActive
                ? 'border-accent text-fg'
                : 'border-transparent text-fg-muted hover:bg-surface-muted hover:text-fg'
            )}
          >
            {/* File status indicator */}
            <span
              className={cn(
                'flex h-4 w-4 items-center justify-center',
                file.status === 'added' && 'text-success',
                file.status === 'deleted' && 'text-danger',
                file.status === 'modified' && 'text-attention',
                file.status === 'renamed' && 'text-accent'
              )}
            >
              <StatusIcon className="h-3.5 w-3.5" weight="bold" />
            </span>

            {/* File icon */}
            <Icon
              className={cn('h-4 w-4 shrink-0', isActive ? 'text-fg-muted' : 'text-fg-subtle')}
              weight="regular"
            />

            {/* File name */}
            <span className="max-w-48 truncate">{fileName}</span>

            {/* Change count */}
            <span className="flex items-center gap-1 text-xs">
              {file.additions > 0 && <span className="text-success">+{file.additions}</span>}
              {file.deletions > 0 && <span className="text-danger">-{file.deletions}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Get the appropriate file icon based on file extension
 */
function getFileIcon(
  path: string
): React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' }> {
  const ext = path.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<
    string,
    React.ComponentType<{ className?: string; weight?: 'regular' | 'bold' }>
  > = {
    ts: FileTs,
    tsx: FileTs,
    js: FileJs,
    jsx: FileJs,
    mjs: FileJs,
    cjs: FileJs,
    json: FileCode,
    html: FileHtml,
    css: FileCss,
    scss: FileCss,
    sass: FileCss,
    less: FileCss,
    md: FileMd,
    mdx: FileMd,
  };

  return iconMap[ext] || FileCode;
}

/**
 * Get the appropriate status icon based on file status
 */
function getStatusIcon(
  status: DiffFileStatus
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
