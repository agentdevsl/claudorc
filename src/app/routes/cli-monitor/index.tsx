import { Terminal } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCliMonitor } from '@/app/components/features/cli-monitor/cli-monitor-context';
import type {
  AlertToast,
  CliSession,
} from '@/app/components/features/cli-monitor/cli-monitor-types';
import {
  formatTokenCount,
  getSessionTokenTotal,
} from '@/app/components/features/cli-monitor/cli-monitor-utils';
import { SessionDetail } from '@/app/components/features/cli-monitor/session-detail';
import { SummaryStrip } from '@/app/components/features/cli-monitor/summary-strip';

// -- Constants --

const VISIBLE_SESSION_LIMIT = 50;

// -- Route --

export const Route = createFileRoute('/cli-monitor/')({
  component: CliMonitorCardsView,
});

// -- Main Page Component --

function CliMonitorCardsView(): React.JSX.Element {
  const { pageState, sessions, alerts, dismissAlert } = useCliMonitor();

  return (
    <>
      {pageState === 'install' && <InstallState />}
      {pageState === 'waiting' && <WaitingState />}
      {pageState === 'active' && (
        <ActiveState sessions={sessions} alerts={alerts} onDismissAlert={dismissAlert} />
      )}
    </>
  );
}

// -- Install State --

function InstallState() {
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText('npx @agentpane/cli-monitor');
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
        <Terminal
          size={40}
          className="text-accent"
          style={{ filter: 'drop-shadow(0 0 12px rgba(88,166,255,0.4))' }}
        />
      </div>

      <h2 className="text-xl font-bold tracking-tight">Monitor your Claude Code sessions</h2>
      <p className="max-w-[400px] text-sm leading-relaxed text-fg-muted">
        See all your CLI sessions across projects in one place. Bring your own agent, centralised
        visibility.
      </p>

      <div className="w-full max-w-[480px]">
        <div className="mb-2 text-left text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
          Install
        </div>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied!' : 'Copy install command'}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-accent bg-default dark:bg-[#0a0e14] px-5 py-4 font-mono text-[15px] text-success shadow-[0_0_20px_rgba(88,166,255,0.1)] transition-all hover:-translate-y-0.5 hover:border-[#79b8ff] hover:shadow-[0_0_30px_rgba(88,166,255,0.2)]"
        >
          <span className="text-fg-subtle">$</span>
          <span className="flex-1 text-left">npx @agentpane/cli-monitor</span>
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-md transition-all ${
              copied
                ? 'bg-success/15 text-success'
                : 'bg-emphasis text-fg-muted hover:bg-accent/15 hover:text-accent'
            }`}
          >
            {copied ? '\u2713' : '\u29C9'}
          </div>
        </button>
      </div>

      <div className="flex w-full max-w-[480px] flex-col gap-2 text-left text-sm text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">{'\uD83D\uDC41'}</span>
          Watches{' '}
          <code className="rounded bg-accent/15 px-1 py-0.5 font-mono text-xs text-accent">
            ~/.claude/projects/
          </code>{' '}
          for session logs
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">{'\uD83D\uDD12'}</span>
          Runs locally &mdash; no data leaves your machine
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">{'\u23FB'}</span>
          Stop anytime:{' '}
          <code className="rounded bg-accent/15 px-1 py-0.5 font-mono text-xs text-accent">
            cli-monitor stop
          </code>
        </div>
      </div>

      <div className="w-full max-w-[480px] text-left">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
          Or install globally
        </div>
        <div className="space-y-2 text-sm text-fg-muted">
          <div className="flex items-center gap-2">
            <code className="rounded bg-accent/15 px-2 py-1 font-mono text-xs text-accent">
              npm i -g @agentpane/cli-monitor
            </code>
          </div>
          <div className="flex items-center gap-2">
            <code className="rounded bg-accent/15 px-2 py-1 font-mono text-xs text-accent">
              brew install agentpane/tap/cli-monitor
            </code>
          </div>
        </div>
      </div>

      <div className="w-full max-w-[400px] opacity-30 transition-opacity hover:opacity-50">
        <div className="relative h-[84px] overflow-hidden rounded-md border border-border bg-default">
          <div className="absolute top-3 left-[10%] h-4 w-[45%] rounded bg-accent/10 border border-accent/15" />
          <div className="absolute top-[34px] left-[25%] h-4 w-[55%] rounded bg-accent/10 border border-accent/15" />
          <div className="absolute top-[56px] left-[5%] h-4 w-[35%] rounded bg-accent/10 border border-accent/15" />
        </div>
      </div>
    </div>
  );
}

// -- Waiting State --

function WaitingState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="relative mb-4 h-20 w-20">
        <div
          className="absolute inset-0 animate-ping rounded-full border border-success opacity-20"
          style={{ animationDuration: '3s' }}
        />
        <div
          className="absolute inset-0 animate-ping rounded-full border border-success opacity-20"
          style={{ animationDuration: '3s', animationDelay: '1s' }}
        />
        <div
          className="absolute inset-0 animate-ping rounded-full border border-success opacity-20"
          style={{ animationDuration: '3s', animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success shadow-[0_0_12px_rgba(63,185,80,0.4)]"
          style={{ animation: 'pulse 2s ease-in-out infinite' }}
        />
      </div>

      <h2 className="text-lg font-semibold">Watching for sessions...</h2>
      <p className="max-w-[360px] text-sm text-fg-muted">
        Start a Claude Code session in any terminal to see it here
      </p>

      <div className="text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
        Try running
      </div>
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-default dark:bg-[#0a0e14] px-4 py-3 font-mono text-sm text-success">
        <span className="text-fg-subtle">$</span>
        claude &quot;fix the auth bug&quot;
        <span className="inline-block h-3.5 w-2 animate-pulse bg-accent" />
      </div>
      <span className="text-xs italic text-fg-subtle">
        or simply{' '}
        <code className="rounded bg-accent/15 px-1 py-0.5 font-mono text-accent">claude</code> for
        interactive
      </span>
    </div>
  );
}

// -- Active State --

function ActiveState({
  sessions,
  alerts,
  onDismissAlert,
}: {
  sessions: CliSession[];
  alerts: AlertToast[];
  onDismissAlert: (id: string) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(VISIBLE_SESSION_LIMIT);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const sessionListRef = useRef<HTMLDivElement | null>(null);
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);

  useEffect(() => {
    if (selectedSessionId && !sessions.some((s) => s.sessionId === selectedSessionId)) {
      setSelectedSessionId(null);
    }
  }, [selectedSessionId, sessions]);

  useEffect(() => {
    if (!selectedSessionId) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedSessionId(null);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedSessionId]);

  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((prev) => prev + VISIBLE_SESSION_LIMIT);
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const flatSessions = useMemo(() => sessions.filter((s) => !s.isSubagent), [sessions]);

  useEffect(() => {
    const el = sessionListRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, flatSessions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < flatSessions.length) {
        e.preventDefault();
        const session = flatSessions[focusedIndex];
        if (session) {
          setSelectedSessionId(session.sessionId === selectedSessionId ? null : session.sessionId);
        }
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [flatSessions, focusedIndex, selectedSessionId]);

  useEffect(() => {
    if (focusedIndex < 0) return;
    const el = sessionListRef.current?.querySelector(`[data-session-index="${focusedIndex}"]`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex]);

  useEffect(() => {
    if (selectedSession && detailPanelRef.current) {
      detailPanelRef.current.focus();
    }
  }, [selectedSession]);

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
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Alert Toasts */}
      {alerts.length > 0 && (
        <output className="flex flex-col items-center gap-2 px-6 py-2" aria-live="polite">
          {alerts.slice(0, 3).map((alert) => (
            <AlertToastItem
              key={alert.id}
              alert={alert}
              onDismiss={() => onDismissAlert(alert.id)}
            />
          ))}
          {alerts.length > 3 && (
            <span className="text-xs text-fg-subtle">+{alerts.length - 3} more</span>
          )}
        </output>
      )}

      {/* Summary Strip */}
      <SummaryStrip sessions={sessions} />

      {/* Session List */}
      <div
        ref={sessionListRef}
        className="flex-1 overflow-y-auto p-4"
        role="listbox"
        aria-label="CLI sessions"
        tabIndex={0}
      >
        <div className="space-y-3">
          {(() => {
            let rendered = 0;
            const groups = Array.from(projectGroups.entries());
            return groups.map(([projectName, projectSessions]) => {
              if (rendered >= visibleCount) return null;
              const remainingSlots = visibleCount - rendered;
              const visibleProjectSessions = projectSessions.slice(0, remainingSlots);
              const startIdx = rendered;
              rendered += visibleProjectSessions.length;
              return (
                <div key={projectName}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    {projectName}
                  </h3>
                  <div className="space-y-2">
                    {visibleProjectSessions.map((session, i) => (
                      <SessionCard
                        key={session.sessionId}
                        session={session}
                        selected={session.sessionId === selectedSessionId}
                        focused={startIdx + i === focusedIndex}
                        dataIndex={startIdx + i}
                        onClick={() =>
                          setSelectedSessionId(
                            session.sessionId === selectedSessionId ? null : session.sessionId
                          )
                        }
                      />
                    ))}
                  </div>
                </div>
              );
            });
          })()}
          {flatSessions.length > visibleCount && (
            <div ref={loadMoreRef} className="py-2 text-center text-xs text-fg-subtle">
              Showing {visibleCount} of {flatSessions.length} sessions &mdash; scroll to load more
            </div>
          )}
        </div>
      </div>

      {/* Selected Session Detail */}
      {selectedSession && (
        <SessionDetail
          ref={detailPanelRef}
          session={selectedSession}
          onClose={() => setSelectedSessionId(null)}
        />
      )}
    </div>
  );
}

// -- Alert Toast --

function AlertToastItem({ alert, onDismiss }: { alert: AlertToast; onDismiss: () => void }) {
  const borderColor = {
    approval: 'border-l-attention',
    input: 'border-l-accent',
    complete: 'border-l-success',
    error: 'border-l-danger',
    'new-session': 'border-l-fg-subtle',
  }[alert.type];

  return (
    <div
      className={`flex w-full max-w-[560px] items-center gap-3 rounded-md border border-border ${borderColor} border-l-4 bg-default px-4 py-2.5 shadow-md animate-in slide-in-from-top-2`}
    >
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-semibold">{alert.title}</span>
        <span className="truncate font-mono text-xs text-fg-muted">{alert.detail}</span>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss alert"
        className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-emphasis hover:text-fg"
      >
        {'\u2715'}
      </button>
    </div>
  );
}

// -- Session Card --

function SessionCard({
  session,
  selected,
  focused,
  dataIndex,
  onClick,
}: {
  session: CliSession;
  selected: boolean;
  focused?: boolean;
  dataIndex?: number;
  onClick: () => void;
}) {
  const statusConfig = {
    working: {
      dot: 'bg-success animate-pulse',
      text: 'Working',
      badge: 'bg-success/15 text-success',
    },
    waiting_for_approval: {
      dot: 'bg-attention',
      text: 'Approval',
      badge: 'bg-attention/15 text-attention',
    },
    waiting_for_input: { dot: 'bg-accent', text: 'Input', badge: 'bg-accent/15 text-accent' },
    idle: { dot: 'bg-fg-subtle', text: 'Idle', badge: 'bg-emphasis text-fg-muted' },
  }[session.status];

  const totalTokens = getSessionTokenTotal(session);

  return (
    <button
      type="button"
      onClick={onClick}
      role="option"
      aria-selected={selected}
      aria-label={`Session: ${session.goal || session.sessionId.slice(0, 8)}`}
      data-session-index={dataIndex}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
        selected
          ? 'border-accent bg-accent/5 shadow-md'
          : focused
            ? 'border-accent bg-subtle ring-2 ring-accent/30'
            : 'border-border bg-default hover:border-fg-subtle hover:bg-subtle'
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusConfig.dot}`} />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="truncate text-sm font-semibold">
          {session.goal || session.sessionId.slice(0, 8)}
        </span>
        <span className="truncate font-mono text-xs text-fg-subtle">
          {session.sessionId.slice(0, 7)} {'\u00B7'} {session.projectName}
          {session.gitBranch && ` \u00B7 ${session.gitBranch}`}
        </span>
      </div>
      <span className={`rounded px-2 py-0.5 text-[11px] font-semibold ${statusConfig.badge}`}>
        {statusConfig.text}
      </span>
      <span className="font-mono text-xs text-fg-muted">{formatTokenCount(totalTokens)}</span>
    </button>
  );
}
