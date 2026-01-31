import { useMemo } from 'react';
import type { CliSession } from './cli-monitor-types';
import { estimateCost, formatTokenCount, getSessionTokenTotal } from './cli-monitor-utils';

function SummaryCard({
  label,
  value,
  detail,
  progressPercent,
  progressColor,
  valueClassName,
}: {
  label: string;
  value: string | number;
  detail: string;
  progressPercent?: number;
  progressColor?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-default px-4 py-3 relative">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <span className={`text-2xl font-bold tabular-nums tracking-tight ${valueClassName ?? ''}`}>
        {value}
      </span>
      <span className="truncate text-xs text-fg-muted">{detail}</span>
      {progressPercent != null && (
        <div className="h-[3px] w-full rounded-full bg-emphasis mt-1">
          <div
            className={`h-full rounded-full transition-all duration-500 ${progressColor ?? 'bg-accent'}`}
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function SummaryStrip({ sessions }: { sessions: CliSession[] }) {
  const flatSessions = useMemo(() => sessions.filter((s) => !s.isSubagent), [sessions]);

  const totalTokens = flatSessions.reduce((sum, s) => sum + getSessionTokenTotal(s), 0);
  const workingCount = flatSessions.filter((s) => s.status === 'working').length;
  const waitingCount = flatSessions.filter(
    (s) => s.status === 'waiting_for_approval' || s.status === 'waiting_for_input'
  ).length;
  const idleCount = flatSessions.filter((s) => s.status === 'idle').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px border-b border-border bg-border">
      <SummaryCard
        label="Active Sessions"
        value={flatSessions.length}
        detail={`${workingCount} working \u00B7 ${waitingCount} waiting \u00B7 ${idleCount} idle`}
        progressPercent={flatSessions.length > 0 ? (workingCount / flatSessions.length) * 100 : 0}
        progressColor="bg-success"
      />
      <SummaryCard
        label="Total Tokens"
        value={formatTokenCount(totalTokens)}
        detail={`~$${estimateCost(totalTokens).toFixed(2)} estimated`}
        progressPercent={totalTokens > 0 ? Math.min((totalTokens / 1_000_000) * 100, 100) : 0}
        progressColor="bg-accent"
      />
      <SummaryCard
        label="Est. Cost"
        value={`$${estimateCost(totalTokens).toFixed(2)}`}
        detail={`${formatTokenCount(totalTokens)} total tokens`}
        valueClassName="text-attention"
      />
      <SummaryCard
        label="Active Branches"
        value={new Set(sessions.filter((s) => s.gitBranch).map((s) => s.gitBranch)).size}
        detail={Array.from(new Set(sessions.map((s) => s.gitBranch).filter(Boolean))).join(', ')}
      />
    </div>
  );
}

export { SummaryCard };
