import {
  CaretDown,
  CaretRight,
  Code,
  Gear,
  Lightning,
  Terminal,
  User,
} from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { StreamEntryProps } from '../types';
import { STREAM_ENTRY_TYPE_CONFIG } from '../types';

const entryContainerVariants = cva(
  'flex gap-2.5 rounded transition-colors duration-fast ease-out',
  {
    variants: {
      type: {
        system: 'hover:bg-surface-subtle',
        user: 'bg-accent/5 hover:bg-accent/10',
        assistant: 'bg-done/5 hover:bg-done/10',
        tool: 'bg-warning/5 hover:bg-warning/10',
      },
      isCurrent: {
        true: 'bg-accent/10 border-l-2 border-accent pl-2',
        false: 'p-2',
      },
    },
    defaultVariants: {
      type: 'system',
      isCurrent: false,
    },
  }
);

const typeIcons = {
  system: Terminal,
  user: User,
  assistant: Code,
  tool: Gear,
} as const;

export function StreamEntry({ entry, isCurrent = false }: StreamEntryProps): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = STREAM_ENTRY_TYPE_CONFIG[entry.type];
  const Icon = typeIcons[entry.type];

  return (
    <div
      className={entryContainerVariants({ type: entry.type, isCurrent })}
      data-testid="stream-entry"
      data-entry-type={entry.type}
    >
      {/* Timestamp */}
      <span className="min-w-15 flex-shrink-0 pt-0.5 font-mono text-xs text-fg-subtle">
        {entry.timeOffset}
      </span>

      {/* Content */}
      <div className="flex-1">
        {/* Type label with model and usage */}
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-medium uppercase tracking-wide',
                config.textClass
              )}
            >
              <Icon className="h-3 w-3" weight="bold" />
              {config.label}
            </span>

            {/* Model badge inline for assistant messages */}
            {entry.type === 'assistant' && entry.model && (
              <span className="inline-flex items-center gap-1 rounded border border-accent/30 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                <Code className="h-3 w-3" weight="bold" />
                {entry.model}
              </span>
            )}
          </div>

          {/* Token usage for assistant messages */}
          {entry.type === 'assistant' && entry.usage && entry.usage.totalTokens > 0 && (
            <span className="flex items-center gap-1 text-xs text-fg-muted">
              <Lightning className="h-3 w-3 text-warning" weight="fill" />
              <span className="tabular-nums">{entry.usage.totalTokens.toLocaleString()}</span>
              <span className="text-fg-subtle">tokens</span>
            </span>
          )}
        </div>

        {/* Main content */}
        <div className="text-sm leading-normal text-fg">{entry.content}</div>

        {/* Tool call details */}
        {entry.toolCall && (
          <div className="mt-2 rounded-md border border-border bg-surface-muted">
            <button
              type="button"
              className="flex w-full items-center justify-between p-3"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <span className="font-mono text-xs font-medium text-warning">
                {entry.toolCall.name}
              </span>
              <span className="flex items-center gap-2 text-xs text-fg-muted">
                {isExpanded ? 'Hide details' : 'Show details'}
                {isExpanded ? (
                  <CaretDown className="h-3 w-3" />
                ) : (
                  <CaretRight className="h-3 w-3" />
                )}
              </span>
            </button>

            {isExpanded && (
              <div className="border-t border-border bg-surface-subtle p-3">
                <pre className="overflow-x-auto font-mono text-xs text-fg-muted">
                  <code>
                    {JSON.stringify(
                      {
                        input: entry.toolCall.input,
                        ...(entry.toolCall.output !== undefined && {
                          output: entry.toolCall.output,
                        }),
                      },
                      null,
                      2
                    )}
                  </code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
