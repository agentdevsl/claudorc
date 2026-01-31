import type { CliSession } from './cli-monitor-types';
import { estimateCost, getSessionTokenTotal } from './cli-monitor-utils';

interface TimelineDetailPanelProps {
  session: CliSession;
  onClose: () => void;
}

export function TimelineDetailPanel({ session, onClose }: TimelineDetailPanelProps) {
  const t = session.tokenUsage;
  const totalTokens = getSessionTokenTotal(session);
  const durationMs = Date.now() - session.startedAt;
  const durationMin = Math.floor(durationMs / 60000);

  // Token bar proportions
  const inputPct = totalTokens > 0 ? ((t?.inputTokens ?? 0) / totalTokens) * 100 : 0;
  const outputPct = totalTokens > 0 ? ((t?.outputTokens ?? 0) / totalTokens) * 100 : 0;
  const cachePct =
    totalTokens > 0
      ? (((t?.cacheReadTokens ?? 0) + (t?.cacheCreationTokens ?? 0)) / totalTokens) * 100
      : 0;

  return (
    <section className="flex h-[280px] shrink-0 border-t border-border bg-default overflow-hidden animate-[slideUpPanel_0.3s_ease]">
      {/* Live output stream */}
      <div className="flex flex-1 flex-col border-r border-border min-w-0">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-subtle shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-accent">{session.sessionId.slice(0, 7)}</span>
            <span className="text-[11px] font-semibold text-success">{'\u25CF'} Live</span>
          </div>
          <span className="font-mono text-[11px] text-fg-subtle">{session.gitBranch}</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-[#0a0e14] p-3 font-mono text-xs leading-relaxed text-fg-muted">
          {session.recentOutput ? (
            <div className="whitespace-pre-wrap">{session.recentOutput}</div>
          ) : (
            <div className="text-fg-subtle italic">No output yet...</div>
          )}
        </div>
      </div>

      {/* Detail sidebar */}
      <div className="flex w-[320px] flex-col overflow-y-auto shrink-0">
        {/* Token breakdown */}
        <div className="p-3 border-b border-border">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Token Usage
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Input</span>
              <span className="font-mono font-medium">
                {(t?.inputTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Output</span>
              <span className="font-mono font-medium">
                {(t?.outputTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Cache read</span>
              <span className="font-mono font-medium">
                {(t?.cacheReadTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-t border-border pt-1 mt-1">
              <span className="font-semibold text-fg-muted">Est. cost</span>
              <span className="font-mono font-medium text-attention">
                ${estimateCost(totalTokens).toFixed(2)}
              </span>
            </div>
          </div>
          {/* Token bar */}
          <div className="h-1.5 bg-emphasis rounded-full overflow-hidden mt-2">
            <div className="flex h-full">
              <div className="h-full bg-accent transition-all" style={{ width: `${inputPct}%` }} />
              <div
                className="h-full bg-[#a371f7] transition-all"
                style={{ width: `${outputPct}%` }}
              />
              <div className="h-full bg-success transition-all" style={{ width: `${cachePct}%` }} />
            </div>
          </div>
          <div className="flex gap-3 mt-2">
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              Input
            </span>
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-[#a371f7]" />
              Output
            </span>
            <span className="flex items-center gap-1 text-[11px] text-fg-subtle">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Cache
            </span>
          </div>
        </div>

        {/* Git activity */}
        <div className="p-3 border-b border-border">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Session Info
          </div>
          <div className="space-y-1 text-xs">
            {session.gitBranch && (
              <div className="flex items-center gap-2 text-fg-muted">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#a371f7]/15 text-[#a371f7] text-[11px] font-mono font-medium rounded">
                  {session.gitBranch}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-fg-muted">Messages</span>
              <span className="font-mono font-medium">{session.messageCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Turns</span>
              <span className="font-mono font-medium">{session.turnCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Duration</span>
              <span className="font-mono font-medium">{durationMin}m</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2 p-3 border-t border-border mt-auto bg-subtle">
          <button
            type="button"
            disabled
            title="Actions not yet connected to daemon"
            className="flex-1 rounded bg-success px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Approve
          </button>
          <button
            type="button"
            disabled
            title="Actions not yet connected to daemon"
            className="flex-1 rounded border border-border bg-subtle px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Input
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          >
            Close
          </button>
        </div>
      </div>
    </section>
  );
}
