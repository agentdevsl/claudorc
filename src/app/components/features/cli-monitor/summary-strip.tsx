import { useMemo } from 'react';
import type { CliSession } from './cli-monitor-types';
import { estimateCost, formatTokenCount, getSessionTokenTotal } from './cli-monitor-utils';

function SummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="flex flex-col gap-1 bg-default px-4 py-3">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </span>
      <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
      <span className="truncate text-xs text-fg-muted">{detail}</span>
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

  const projectGroups = useMemo(() => {
    const groups = new Map<string, CliSession[]>();
    for (const s of sessions) {
      if (s.isSubagent) continue;
      const key = s.projectName || 'Unknown';
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    }
    return groups;
  }, [sessions]);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-px border-b border-border bg-border">
      <SummaryCard
        label="Active Sessions"
        value={flatSessions.length}
        detail={`${workingCount} working \u00B7 ${waitingCount} waiting \u00B7 ${idleCount} idle`}
      />
      <SummaryCard
        label="Total Tokens"
        value={formatTokenCount(totalTokens)}
        detail={`~$${estimateCost(totalTokens).toFixed(2)} estimated`}
      />
      <SummaryCard
        label="Projects"
        value={projectGroups.size}
        detail={Array.from(projectGroups.keys()).join(', ')}
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
