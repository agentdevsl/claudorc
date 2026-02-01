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

export function estimateCost(tokens: number): number;
export function estimateCost(session: CliSession): number;
export function estimateCost(arg: number | CliSession): number {
  if (typeof arg === 'number') {
    // Fallback flat rate for raw token count
    return (arg / 1_000_000) * 5;
  }
  const t = arg.tokenUsage;
  if (!t) return 0;
  const inputCost = ((t.inputTokens ?? 0) / 1_000_000) * 3;
  const outputCost = ((t.outputTokens ?? 0) / 1_000_000) * 15;
  const cacheCreateCost = ((t.cacheCreationTokens ?? 0) / 1_000_000) * 3.75;
  const cacheReadCost = ((t.cacheReadTokens ?? 0) / 1_000_000) * 0.3;
  return inputCost + outputCost + cacheCreateCost + cacheReadCost;
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
