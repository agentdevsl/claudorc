import { Terminal } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { apiClient } from '@/lib/api/client';

// -- Types --

type CliSessionStatus = 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';
type PageState = 'install' | 'waiting' | 'active';
type AggregateStatus = 'nominal' | 'attention' | 'danger' | 'idle';

interface CliSession {
  sessionId: string;
  filePath: string;
  cwd: string;
  projectName: string;
  gitBranch?: string;
  status: CliSessionStatus;
  messageCount: number;
  turnCount: number;
  goal?: string;
  recentOutput?: string;
  pendingToolUse?: { toolName: string; toolId: string };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  model?: string;
  startedAt: number;
  lastActivityAt: number;
  isSubagent: boolean;
  parentSessionId?: string;
}

interface AlertToast {
  id: string;
  type: 'approval' | 'input' | 'complete' | 'error' | 'new-session';
  title: string;
  detail: string;
  sessionId: string;
  autoDismiss: boolean;
  createdAt: number;
}

// -- Route --

export const Route = createFileRoute('/cli-monitor/')({
  component: CliMonitorPage,
});

// -- Status Derivation --

function deriveAggregateStatus(sessions: CliSession[]): AggregateStatus {
  if (sessions.length === 0) return 'idle';
  let hasWorking = false;
  for (const s of sessions) {
    if (s.status === 'waiting_for_approval' || s.status === 'waiting_for_input') return 'attention';
    if (s.status === 'working') hasWorking = true;
  }
  if (hasWorking) return 'nominal';
  return 'idle';
}

// -- Hook: CLI Monitor State --

function useCliMonitorState() {
  const [pageState, setPageState] = useState<PageState>('install');
  const [sessions, setSessions] = useState<CliSession[]>([]);
  const [daemonConnected, setDaemonConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertToast[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Dismiss alert
  const dismissAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  // Add alert
  const addAlert = useCallback((alert: Omit<AlertToast, 'id' | 'createdAt'>) => {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newAlert: AlertToast = { ...alert, id, createdAt: Date.now() };
    setAlerts((prev) => {
      const updated = [newAlert, ...prev].slice(0, 5); // Max 5
      return updated;
    });

    // Auto-dismiss
    if (alert.autoDismiss) {
      const timeout = alert.type === 'new-session' ? 3000 : 5000;
      setTimeout(() => {
        setAlerts((prev) => prev.filter((a) => a.id !== id));
      }, timeout);
    }
  }, []);

  // Poll for daemon on install page
  useEffect(() => {
    if (pageState !== 'install') return;

    const poll = setInterval(async () => {
      try {
        const result = await apiClient.cliMonitor.status();
        if (result.ok && result.data.connected) {
          setDaemonConnected(true);
          setPageState(result.data.sessionCount > 0 ? 'active' : 'waiting');
        }
      } catch {
        // Server may be down
      }
    }, 3000);

    return () => clearInterval(poll);
  }, [pageState]);

  // SSE stream for live updates
  useEffect(() => {
    if (pageState === 'install') return;

    const streamUrl = apiClient.cliMonitor.getStreamUrl();
    const source = new EventSource(streamUrl);
    eventSourceRef.current = source;

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'cli-monitor:snapshot':
            setSessions(data.sessions || []);
            setDaemonConnected(data.connected);
            if (!data.connected) {
              setPageState('install');
            } else if ((data.sessions || []).length === 0) {
              setPageState('waiting');
            } else {
              setPageState('active');
            }
            break;

          case 'cli-monitor:daemon-connected':
            setDaemonConnected(true);
            break;

          case 'cli-monitor:daemon-disconnected':
            setDaemonConnected(false);
            setPageState('install');
            setSessions([]);
            break;

          case 'cli-monitor:session-update': {
            const session = data.session as CliSession;
            setSessions((prev) => {
              const exists = prev.some((s) => s.sessionId === session.sessionId);
              if (exists) {
                return prev.map((s) => (s.sessionId === session.sessionId ? session : s));
              }
              return [...prev, session];
            });
            setPageState('active');

            // Trigger alert on status change
            if (data.previousStatus && data.previousStatus !== session.status) {
              if (session.status === 'waiting_for_approval') {
                addAlert({
                  type: 'approval',
                  title: 'Approval needed',
                  detail: `${session.sessionId.slice(0, 7)} — ${session.goal || 'Unknown task'}`,
                  sessionId: session.sessionId,
                  autoDismiss: false,
                });
              } else if (session.status === 'idle' && data.previousStatus === 'working') {
                addAlert({
                  type: 'complete',
                  title: 'Session completed',
                  detail: `${session.sessionId.slice(0, 7)} — ${session.goal || 'Unknown task'}`,
                  sessionId: session.sessionId,
                  autoDismiss: true,
                });
              }
            }

            if (!data.previousStatus) {
              addAlert({
                type: 'new-session',
                title: 'New session detected',
                detail: `${session.projectName} — ${session.goal || session.sessionId.slice(0, 7)}`,
                sessionId: session.sessionId,
                autoDismiss: true,
              });
            }
            break;
          }

          case 'cli-monitor:session-removed':
            setSessions((prev) => {
              const remaining = prev.filter((s) => s.sessionId !== data.sessionId);
              if (remaining.length === 0) setPageState('waiting');
              return remaining;
            });
            break;
        }
      } catch {
        // Invalid JSON
      }
    };

    source.onerror = () => {
      // Reconnection is handled automatically by EventSource
    };

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [pageState, addAlert]);

  const aggregateStatus = deriveAggregateStatus(sessions);

  return { pageState, sessions, daemonConnected, aggregateStatus, alerts, dismissAlert };
}

// -- Main Page Component --

function CliMonitorPage(): React.JSX.Element {
  const { pageState, sessions, daemonConnected, aggregateStatus, alerts, dismissAlert } =
    useCliMonitorState();

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'CLI Monitor', to: '/cli-monitor' }]}
      actions={
        <div className="flex items-center gap-3">
          {pageState === 'active' && <StatusIndicator status={aggregateStatus} />}
          <DaemonToggle connected={daemonConnected} />
        </div>
      }
    >
      <div className="flex flex-1 flex-col overflow-hidden">
        {pageState === 'install' && <InstallState />}
        {pageState === 'waiting' && <WaitingState />}
        {pageState === 'active' && (
          <ActiveState
            sessions={sessions}
            aggregateStatus={aggregateStatus}
            alerts={alerts}
            onDismissAlert={dismissAlert}
          />
        )}
      </div>
    </LayoutShell>
  );
}

// -- Sub-Components --

function StatusIndicator({ status }: { status: AggregateStatus }) {
  const config = {
    nominal: {
      label: 'LIVE',
      dotClass: 'bg-success animate-pulse',
      bgClass: 'bg-success/15 text-success',
    },
    attention: {
      label: 'WAITING',
      dotClass: 'bg-attention',
      bgClass: 'bg-attention/15 text-attention',
    },
    danger: { label: 'ALERT', dotClass: 'bg-danger', bgClass: 'bg-danger/15 text-danger' },
    idle: { label: 'IDLE', dotClass: 'bg-fg-subtle', bgClass: 'bg-muted text-fg-muted' },
  }[status];

  return (
    <div
      className={`flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold ${config.bgClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </div>
  );
}

function DaemonToggle({ connected }: { connected: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm font-medium text-fg-muted">Daemon</span>
      <div
        className={`relative h-[22px] w-10 rounded-full transition-colors ${
          connected ? 'bg-success' : 'bg-emphasis'
        }`}
      >
        <div
          className={`absolute top-[3px] left-[3px] h-4 w-4 rounded-full bg-white transition-transform ${
            connected ? 'translate-x-[18px]' : ''
          }`}
        />
      </div>
    </div>
  );
}

// -- Install State --

function InstallState() {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText('npx @agentpane/cli-monitor');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Hero Icon */}
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

      {/* Install Command (Primary CTA) */}
      <div className="w-full max-w-[480px]">
        <div className="mb-2 text-left text-[11px] font-bold uppercase tracking-wider text-fg-subtle">
          Install
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-accent bg-[#0a0e14] px-5 py-4 font-mono text-[15px] text-success shadow-[0_0_20px_rgba(88,166,255,0.1)] transition-all hover:-translate-y-0.5 hover:border-[#79b8ff] hover:shadow-[0_0_30px_rgba(88,166,255,0.2)]"
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

      {/* Info Strip */}
      <div className="flex w-full max-w-[480px] flex-col gap-2 text-left text-sm text-fg-muted">
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">\uD83D\uDC41</span>
          Watches{' '}
          <code className="rounded bg-accent/15 px-1 py-0.5 font-mono text-xs text-accent">
            ~/.claude/projects/
          </code>{' '}
          for session logs
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">\uD83D\uDD12</span>
          Runs locally — no data leaves your machine
        </div>
        <div className="flex items-center gap-2">
          <span className="text-fg-subtle">\u23FB</span>
          Stop anytime:{' '}
          <code className="rounded bg-accent/15 px-1 py-0.5 font-mono text-xs text-accent">
            cli-monitor stop
          </code>
        </div>
      </div>

      {/* Alternative install methods */}
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

      {/* Ghost Preview */}
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
      {/* Radar Animation */}
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
      <div className="inline-flex items-center gap-2 rounded-md border border-border bg-[#0a0e14] px-4 py-3 font-mono text-sm text-success">
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
  aggregateStatus: AggregateStatus;
  alerts: AlertToast[];
  onDismissAlert: (id: string) => void;
}) {
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = sessions.find((s) => s.sessionId === selectedSessionId);

  // Summary stats
  // Exclude subagents from summary stats to match visible card count
  const visibleSessions = sessions.filter((s) => !s.isSubagent);
  const totalTokens = visibleSessions.reduce(
    (sum, s) =>
      sum +
      s.tokenUsage.inputTokens +
      s.tokenUsage.outputTokens +
      s.tokenUsage.cacheCreationTokens +
      s.tokenUsage.cacheReadTokens,
    0
  );
  const workingCount = visibleSessions.filter((s) => s.status === 'working').length;
  const waitingCount = visibleSessions.filter(
    (s) => s.status === 'waiting_for_approval' || s.status === 'waiting_for_input'
  ).length;
  const idleCount = visibleSessions.filter((s) => s.status === 'idle').length;

  // Group sessions by project
  const projectGroups = useMemo(() => {
    const groups = new Map<string, CliSession[]>();
    for (const s of sessions) {
      if (s.isSubagent) continue; // Skip subagents in top-level grouping
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
        <div className="flex flex-col items-center gap-2 px-6 py-2">
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
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-4 gap-px border-b border-border bg-border">
        <SummaryCard
          label="Active Sessions"
          value={visibleSessions.length}
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

      {/* Session List */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {Array.from(projectGroups.entries()).map(([projectName, projectSessions]) => (
            <div key={projectName}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                {projectName}
              </h3>
              <div className="space-y-2">
                {projectSessions.map((session) => (
                  <SessionCard
                    key={session.sessionId}
                    session={session}
                    selected={session.sessionId === selectedSessionId}
                    onClick={() =>
                      setSelectedSessionId(
                        session.sessionId === selectedSessionId ? null : session.sessionId
                      )
                    }
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected Session Detail */}
      {selectedSession && (
        <SessionDetail session={selectedSession} onClose={() => setSelectedSessionId(null)} />
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
        className="flex h-6 w-6 items-center justify-center rounded text-fg-subtle hover:bg-emphasis hover:text-fg"
      >
        \u2715
      </button>
    </div>
  );
}

// -- Summary Card --

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

// -- Session Card --

function SessionCard({
  session,
  selected,
  onClick,
}: {
  session: CliSession;
  selected: boolean;
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

  const totalTokens =
    session.tokenUsage.inputTokens +
    session.tokenUsage.outputTokens +
    session.tokenUsage.cacheCreationTokens +
    session.tokenUsage.cacheReadTokens;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-all ${
        selected
          ? 'border-accent bg-accent/5 shadow-md'
          : 'border-border bg-default hover:border-fg-subtle hover:bg-subtle'
      }`}
    >
      <span className={`h-2 w-2 flex-shrink-0 rounded-full ${statusConfig.dot}`} />
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <span className="truncate text-sm font-semibold">
          {session.goal || session.sessionId.slice(0, 8)}
        </span>
        <span className="truncate font-mono text-xs text-fg-subtle">
          {session.sessionId.slice(0, 7)} \u00B7 {session.projectName}
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

// -- Session Detail Panel --

function SessionDetail({ session, onClose }: { session: CliSession; onClose: () => void }) {
  const totalTokens =
    session.tokenUsage.inputTokens +
    session.tokenUsage.outputTokens +
    session.tokenUsage.cacheCreationTokens +
    session.tokenUsage.cacheReadTokens;
  const durationMs = Date.now() - session.startedAt;
  const durationMin = Math.floor(durationMs / 60000);

  return (
    <div className="flex h-[280px] shrink-0 border-t border-border bg-default animate-in slide-in-from-bottom-2">
      {/* Stream output */}
      <div className="flex flex-1 flex-col border-r border-border min-w-0">
        <div className="flex items-center justify-between border-b border-border bg-subtle px-4 py-2">
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
      <div className="flex w-[320px] flex-col overflow-y-auto">
        <div className="border-b border-border p-3">
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            Token Usage
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-fg-muted">Input</span>
              <span className="font-mono font-medium">
                {session.tokenUsage.inputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Output</span>
              <span className="font-mono font-medium">
                {session.tokenUsage.outputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-fg-muted">Cache</span>
              <span className="font-mono font-medium">
                {session.tokenUsage.cacheReadTokens.toLocaleString()}
              </span>
            </div>
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
            className="flex-1 rounded border border-danger px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Utilities --

function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

function estimateCost(tokens: number): number {
  // Rough estimate: $3/1M input tokens + $15/1M output tokens, averaged
  return (tokens / 1_000_000) * 5;
}
