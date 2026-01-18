import { CaretDown, CaretRight } from '@phosphor-icons/react';
import { useState } from 'react';
import type { DiffHunk as DiffHunkType } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';
import { DiffLine } from './diff-line';

interface DiffHunkProps {
  hunk: DiffHunkType;
  defaultExpanded?: boolean;
}

/**
 * Individual hunk display with:
 * - Hunk header (@@ -x,y +x,y @@)
 * - Context lines
 * - Addition/deletion lines
 * - Expand/collapse control
 */
export function DiffHunk({ hunk, defaultExpanded = true }: DiffHunkProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => setIsExpanded(!isExpanded);

  return (
    <div className="border-t border-border first:border-t-0">
      {/* Hunk header */}
      <button
        type="button"
        onClick={toggleExpanded}
        className={cn(
          'flex w-full items-center gap-2 px-4 py-2 text-left font-mono text-xs',
          'bg-accent-muted/15 text-accent transition duration-fast ease-out',
          'hover:bg-accent-muted/25'
        )}
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center text-fg-muted">
          {isExpanded ? (
            <CaretDown className="h-3 w-3" weight="bold" />
          ) : (
            <CaretRight className="h-3 w-3" weight="bold" />
          )}
        </span>
        <span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
          {hunk.header ||
            `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`}
        </span>
        <span className="shrink-0 text-fg-subtle">{hunk.lines.length} lines</span>
      </button>

      {/* Hunk content */}
      {isExpanded && (
        <div className="font-mono text-[13px] leading-6">
          {hunk.lines.map((line, lineIndex) => (
            <DiffLine key={lineIndex} line={line} />
          ))}
        </div>
      )}
    </div>
  );
}
