import { forwardRef } from 'react';
import type { CliSession } from './cli-monitor-types';
import { getSessionTokenTotal } from './cli-monitor-utils';

export const SessionDetail = forwardRef<
  HTMLDivElement,
  { session: CliSession; onClose: () => void }
>(function SessionDetail({ session, onClose }, ref) {
  const totalTokens = getSessionTokenTotal(session);
  const durationMs = Date.now() - session.startedAt;
  const durationMin = Math.floor(durationMs / 60000);

  const t = session.tokenUsage;

  return (
    <section
      ref={ref}
      tabIndex={-1}
      aria-label="Session details"
      className="flex h-[280px] shrink-0 border-t border-border bg-default animate-in slide-in-from-bottom-2 max-md:fixed max-md:inset-0 max-md:z-50 max-md:h-full max-md:flex-col"
    >
      {/* Stream output */}
      <div className="flex flex-1 flex-col border-r border-border min-w-0">
        <div className="flex items-center justify-between border-b border-border bg-subtle px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-accent">{session.sessionId.slice(0, 7)}</span>
            <span className="text-[11px] font-semibold text-success">{'\u25CF'} Live</span>
          </div>
          <span className="font-mono text-[11px] text-fg-subtle">{session.gitBranch}</span>
        </div>
        <div className="flex-1 overflow-y-auto bg-default dark:bg-[#0a0e14] p-3 font-mono text-xs leading-relaxed text-fg-muted">
          {session.recentOutput ? (
            <div className="whitespace-pre-wrap">{session.recentOutput}</div>
          ) : (
            <div className="text-fg-subtle italic">No output yet...</div>
          )}
        </div>
      </div>

      {/* Detail sidebar */}
      <div className="flex w-[320px] max-md:w-full flex-col overflow-y-auto">
        <div className="border-b border-border p-3">
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
              <span className="text-fg-muted">Cache Creation</span>
              <span className="font-mono font-medium">
                {(t?.cacheCreationTokens ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Cache Read</span>
              <span className="font-mono font-medium">
                {(t?.cacheReadTokens ?? 0).toLocaleString()}
              </span>
            </div>
            {(t?.ephemeral5mTokens ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-fg-muted">Ephemeral 5m</span>
                <span className="font-mono font-medium">
                  {(t?.ephemeral5mTokens ?? 0).toLocaleString()}
                </span>
              </div>
            )}
            {(t?.ephemeral1hTokens ?? 0) > 0 && (
              <div className="flex justify-between">
                <span className="text-fg-muted">Ephemeral 1h</span>
                <span className="font-mono font-medium">
                  {(t?.ephemeral1hTokens ?? 0).toLocaleString()}
                </span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-1">
              <span className="font-semibold text-fg-muted">Total</span>
              <span className="font-mono font-medium">{totalTokens.toLocaleString()}</span>
            </div>
          </div>
        </div>
        <div className="border-b border-border p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Session Info
          </div>
          <div className="space-y-1 text-xs">
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
            {session.model && (
              <div className="flex justify-between">
                <span className="text-fg-muted">Model</span>
                <span className="font-mono font-medium text-[11px]">{session.model}</span>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto flex gap-2 border-t border-border bg-subtle p-3">
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
            aria-label="Close session detail"
            className="flex-1 rounded border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          >
            Close
          </button>
        </div>
      </div>
    </section>
  );
});
