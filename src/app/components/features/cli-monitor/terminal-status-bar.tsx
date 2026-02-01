import { useMemo } from 'react';
import type { CliSession } from './cli-monitor-types';
import { estimateCost, formatTokenCount, getSessionTokenTotal } from './cli-monitor-utils';

export function TerminalStatusBar({ sessions }: { sessions: CliSession[] }) {
  const flat = useMemo(() => sessions.filter((s) => !s.isSubagent), [sessions]);
  const totalTokens = flat.reduce((sum, s) => sum + getSessionTokenTotal(s), 0);
  const workingCount = flat.filter((s) => s.status === 'working').length;
  const waitingCount = flat.filter(
    (s) => s.status === 'waiting_for_approval' || s.status === 'waiting_for_input'
  ).length;
  const idleCount = flat.filter((s) => s.status === 'idle').length;
  const branches = new Set(sessions.filter((s) => s.gitBranch).map((s) => s.gitBranch));

  return (
    <div className="flex items-center justify-between px-4 py-1 bg-default border-t border-border shrink-0 min-h-[28px]">
      <div className="flex items-center gap-4">
        <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted">
          <strong className="text-fg font-semibold">{flat.length}</strong> sessions
          <span className="text-fg-subtle">&middot;</span>
          <span className="text-success font-semibold">{workingCount} working</span>
          <span className="text-fg-subtle">&middot;</span>
          {waitingCount} waiting
          <span className="text-fg-subtle">&middot;</span>
          {idleCount} idle
        </span>
        <span className="flex items-center gap-1 text-[11px] font-mono text-fg-muted">
          <strong className="text-fg font-semibold">{formatTokenCount(totalTokens)}</strong> tokens
        </span>
        <span className="text-[11px] font-mono text-attention font-semibold">
          ${estimateCost(totalTokens).toFixed(2)} est.
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-[11px] font-mono text-fg-muted">
          <span className="text-accent font-semibold">{branches.size}</span> branches
        </span>
      </div>
    </div>
  );
}
