import type { DiffLine as DiffLineType } from '@/lib/types/diff';
import { cn } from '@/lib/utils/cn';

interface DiffLineProps {
  line: DiffLineType;
}

/**
 * Single line rendering with:
 * - Line number (old and new)
 * - Line type indicator (+/-/space)
 * - Line content with syntax highlighting
 * - Background color based on type
 */
export function DiffLine({ line }: DiffLineProps): React.JSX.Element {
  const { type, content, oldLineNumber, newLineNumber } = line;

  return (
    <div
      className={cn(
        'group flex min-h-6 font-mono text-[13px] leading-6',
        type === 'addition' && 'bg-success-muted/15',
        type === 'deletion' && 'bg-danger-muted/15',
        type === 'context' && 'hover:bg-surface-muted'
      )}
    >
      {/* Old line number */}
      <span
        className={cn(
          'flex w-12 shrink-0 select-none items-center justify-end px-2 text-right text-fg-subtle',
          type === 'addition' && 'bg-success-muted/25 text-success',
          type === 'deletion' && 'bg-danger-muted/25 text-danger'
        )}
      >
        {oldLineNumber ?? ''}
      </span>

      {/* New line number */}
      <span
        className={cn(
          'flex w-12 shrink-0 select-none items-center justify-end border-r border-border px-2 text-right text-fg-subtle',
          type === 'addition' && 'bg-success-muted/25 text-success',
          type === 'deletion' && 'bg-danger-muted/25 text-danger'
        )}
      >
        {newLineNumber ?? ''}
      </span>

      {/* Line type indicator */}
      <span
        className={cn(
          'flex w-6 shrink-0 select-none items-center justify-center text-fg-subtle',
          type === 'addition' && 'text-success',
          type === 'deletion' && 'text-danger'
        )}
      >
        {type === 'addition' && '+'}
        {type === 'deletion' && '-'}
        {type === 'context' && ' '}
      </span>

      {/* Line content */}
      <span
        className={cn(
          'flex-1 overflow-x-auto whitespace-pre px-4',
          type === 'addition' && 'text-success',
          type === 'deletion' && 'text-danger',
          type === 'context' && 'text-fg-muted'
        )}
      >
        <SyntaxHighlight content={content} />
      </span>
    </div>
  );
}

interface SyntaxHighlightProps {
  content: string;
}

/**
 * Basic syntax highlighting for common patterns.
 * This is a simplified implementation - a full implementation
 * would use a proper syntax highlighting library.
 */
function SyntaxHighlight({ content }: SyntaxHighlightProps): React.JSX.Element {
  // For now, render content as-is with styling
  // A full implementation would parse and highlight keywords, strings, etc.
  return <span>{content}</span>;
}
