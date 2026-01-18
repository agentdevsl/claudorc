import {
  ArrowClockwise,
  Check,
  CircleNotch,
  Database,
  GithubLogo,
  Globe,
  HardDrives,
  Heartbeat,
  Warning,
  X,
} from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { apiClient } from '@/lib/api/client';

export const Route = createFileRoute('/settings/system')({
  component: SystemHealthPage,
});

type HealthStatus = {
  status: 'healthy' | 'degraded';
  timestamp: string;
  uptime: number;
  checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    github: { status: 'ok' | 'error' | 'not_configured'; login?: string | null };
  };
  responseTimeMs: number;
};

type FrontendHealth = {
  status: 'ok' | 'error';
  viteServer: boolean;
};

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function StatusBadge({
  status,
  label,
}: {
  status: 'ok' | 'error' | 'not_configured' | 'unknown';
  label?: string;
}): React.JSX.Element {
  const config = {
    ok: {
      bg: 'bg-success-muted',
      text: 'text-success',
      icon: Check,
      defaultLabel: 'Healthy',
    },
    error: {
      bg: 'bg-danger-muted',
      text: 'text-danger',
      icon: X,
      defaultLabel: 'Error',
    },
    not_configured: {
      bg: 'bg-attention-muted',
      text: 'text-attention',
      icon: Warning,
      defaultLabel: 'Not Configured',
    },
    unknown: {
      bg: 'bg-surface-subtle',
      text: 'text-fg-muted',
      icon: CircleNotch,
      defaultLabel: 'Checking...',
    },
  };

  const { bg, text, icon: Icon, defaultLabel } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${text}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === 'unknown' ? 'animate-spin' : ''}`} weight="bold" />
      {label ?? defaultLabel}
    </span>
  );
}

function SystemHealthPage(): React.JSX.Element {
  const [backendHealth, setBackendHealth] = useState<HealthStatus | null>(null);
  const [frontendHealth, setFrontendHealth] = useState<FrontendHealth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkHealth = useCallback(async () => {
    setIsLoading(true);

    // Check frontend (Vite dev server)
    try {
      const viteResponse = await fetch('/');
      setFrontendHealth({
        status: viteResponse.ok ? 'ok' : 'error',
        viteServer: viteResponse.ok,
      });
    } catch {
      setFrontendHealth({ status: 'error', viteServer: false });
    }

    // Check backend (Bun API server)
    try {
      const result = await apiClient.system.health();
      if (result.ok) {
        setBackendHealth(result.data);
      } else {
        setBackendHealth(null);
      }
    } catch {
      setBackendHealth(null);
    }

    setLastChecked(new Date());
    setIsLoading(false);
  }, []);

  useEffect(() => {
    checkHealth();
    // Auto-refresh every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const overallStatus =
    frontendHealth?.status === 'ok' && backendHealth?.status === 'healthy' ? 'ok' : 'error';

  return (
    <div data-testid="system-health-settings" className="mx-auto max-w-4xl px-8 py-8">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="flex items-center gap-3 text-2xl font-semibold text-fg">
          <Heartbeat className="h-7 w-7 text-fg-muted" />
          System Health
        </h1>
        <p className="mt-2 text-fg-muted">
          Monitor the health status of frontend and backend services.
        </p>
      </header>

      <div className="space-y-6">
        {/* Overall Status */}
        <div className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  overallStatus === 'ok' ? 'bg-success-muted' : 'bg-danger-muted'
                }`}
              >
                {overallStatus === 'ok' ? (
                  <Check className="h-6 w-6 text-success" weight="bold" />
                ) : (
                  <Warning className="h-6 w-6 text-danger" weight="bold" />
                )}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-fg">
                  {overallStatus === 'ok' ? 'All Systems Operational' : 'System Issues Detected'}
                </h2>
                {lastChecked && (
                  <p className="text-sm text-fg-muted">
                    Last checked: {lastChecked.toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={checkHealth} disabled={isLoading}>
              {isLoading ? (
                <CircleNotch className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ArrowClockwise className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Frontend Health */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-muted">
              <Globe className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-fg">Frontend (Vite)</h2>
              <p className="text-xs text-fg-muted">React application server</p>
            </div>
            <StatusBadge status={frontendHealth?.status ?? 'unknown'} />
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-fg-muted">Port:</span>
                <span className="ml-2 font-mono text-fg">3000</span>
              </div>
              <div>
                <span className="text-fg-muted">Status:</span>
                <span className="ml-2 text-fg">
                  {frontendHealth?.viteServer ? 'Running' : 'Not responding'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Backend Health */}
        <div className="rounded-lg border border-border bg-surface">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-done-muted">
              <HardDrives className="h-4 w-4 text-done" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-fg">Backend (Bun API)</h2>
              <p className="text-xs text-fg-muted">Database and API server</p>
            </div>
            <StatusBadge
              status={
                backendHealth ? (backendHealth.status === 'healthy' ? 'ok' : 'error') : 'error'
              }
              label={
                backendHealth
                  ? backendHealth.status === 'healthy'
                    ? 'Healthy'
                    : 'Degraded'
                  : 'Offline'
              }
            />
          </div>
          <div className="p-5 space-y-4">
            {backendHealth ? (
              <>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-fg-muted">Port:</span>
                    <span className="ml-2 font-mono text-fg">3001</span>
                  </div>
                  <div>
                    <span className="text-fg-muted">Uptime:</span>
                    <span className="ml-2 text-fg">{formatUptime(backendHealth.uptime)}</span>
                  </div>
                  <div>
                    <span className="text-fg-muted">Response time:</span>
                    <span className="ml-2 text-fg">{backendHealth.responseTimeMs}ms</span>
                  </div>
                </div>

                {/* Service Checks */}
                <div className="border-t border-border pt-4">
                  <h3 className="mb-3 text-sm font-medium text-fg">Service Checks</h3>
                  <div className="space-y-3">
                    {/* Database */}
                    <div className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Database className="h-4 w-4 text-fg-muted" />
                        <span className="text-sm text-fg">SQLite Database</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {backendHealth.checks.database.latencyMs !== undefined && (
                          <span className="text-xs text-fg-muted">
                            {backendHealth.checks.database.latencyMs}ms
                          </span>
                        )}
                        <StatusBadge status={backendHealth.checks.database.status} />
                      </div>
                    </div>

                    {/* GitHub */}
                    <div className="flex items-center justify-between rounded-md bg-surface-subtle px-3 py-2">
                      <div className="flex items-center gap-2">
                        <GithubLogo className="h-4 w-4 text-fg-muted" />
                        <span className="text-sm text-fg">GitHub Integration</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {backendHealth.checks.github.login && (
                          <span className="text-xs text-fg-muted">
                            @{backendHealth.checks.github.login}
                          </span>
                        )}
                        <StatusBadge status={backendHealth.checks.github.status} />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-md bg-danger-muted/30 p-4 text-center">
                <Warning className="mx-auto h-8 w-8 text-danger" />
                <p className="mt-2 text-sm font-medium text-danger">
                  Backend server is not responding
                </p>
                <p className="mt-1 text-xs text-fg-muted">
                  Make sure the API server is running on port 3001
                </p>
                <code className="mt-3 block rounded bg-surface-subtle px-3 py-2 text-xs font-mono text-fg-muted">
                  bun run src/server/api.ts
                </code>
              </div>
            )}
          </div>
        </div>

        {/* Help Text */}
        <div className="rounded-md border border-border bg-surface-subtle p-4">
          <p className="text-sm text-fg-muted">
            <strong className="mr-1 text-fg">Tip:</strong>
            If services are showing as offline, try restarting them. The frontend runs on{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono">
              localhost:3000
            </code>{' '}
            and the backend API runs on{' '}
            <code className="rounded bg-surface px-1.5 py-0.5 text-xs font-mono">
              localhost:3001
            </code>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
