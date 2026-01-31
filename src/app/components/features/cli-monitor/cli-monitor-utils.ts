import type { AggregateStatus, CliSession } from './cli-monitor-types';

export function getSessionTokenTotal(s: CliSession): number {
  const t = s.tokenUsage;
  if (!t) return 0;
  return (
    (t.inputTokens ?? 0) +
    (t.outputTokens ?? 0) +
    (t.cacheCreationTokens ?? 0) +
    (t.cacheReadTokens ?? 0) +
    (t.ephemeral5mTokens ?? 0) +
    (t.ephemeral1hTokens ?? 0)
  );
}

export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

export function estimateCost(tokens: number): number {
  // Rough estimate: $3/1M input tokens + $15/1M output tokens, averaged
  return (tokens / 1_000_000) * 5;
}

export function deriveAggregateStatus(sessions: CliSession[]): AggregateStatus {
  if (sessions.length === 0) return 'idle';
  let hasWorking = false;
  for (const s of sessions) {
    if (s.status === 'waiting_for_approval' || s.status === 'waiting_for_input') return 'attention';
    if (s.status === 'working') hasWorking = true;
  }
  if (hasWorking) return 'nominal';
  return 'idle';
}
