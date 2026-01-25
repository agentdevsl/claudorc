import { Clock, Gear, WarningCircle } from '@phosphor-icons/react';
import type * as React from 'react';
import type { ToolCallSummaryBarProps } from '../types';
import { formatDuration } from '../utils/format-duration';

export function ToolCallSummaryBar({ stats }: ToolCallSummaryBarProps): React.JSX.Element {
  const hasErrors = stats.errorCount > 0;

  return (
    <div
      className="shrink-0 border-t border-border bg-surface-subtle px-3 py-2 md:px-4"
      data-testid="tool-call-summary-bar"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="font-medium text-fg-muted">Tools</span>
        <span className="h-3 w-px bg-border" />

        <span className="flex items-center gap-1 text-fg-muted">
          <Gear className="h-3.5 w-3.5" weight="bold" />
          <span className="font-medium text-fg">{stats.totalCalls}</span> Calls
        </span>

        <span className="h-3 w-px bg-border" />

        <span className={`flex items-center gap-1 ${hasErrors ? 'text-danger' : 'text-fg-muted'}`}>
          <WarningCircle className="h-3.5 w-3.5" weight="bold" />
          <span className={`font-medium ${hasErrors ? 'text-danger' : 'text-fg'}`}>
            {stats.errorCount}
          </span>{' '}
          Errors
        </span>

        <span className="h-3 w-px bg-border" />

        <span className="flex items-center gap-1 text-fg-muted">
          <Clock className="h-3.5 w-3.5" weight="bold" />
          Avg: <span className="font-medium text-fg">{formatDuration(stats.avgDurationMs)}</span>
        </span>
      </div>
    </div>
  );
}
