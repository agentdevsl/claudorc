import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AgentSessionView } from '@/app/components/features/agent-session-view';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { apiClient } from '@/lib/api/client';

// Session type for client-side display
type ClientSession = {
  id: string;
  agentId?: string | null;
  title?: string | null;
  status: string;
};

export const Route = createFileRoute('/sessions/$sessionId')({
  component: SessionPage,
});

function SessionPage(): React.JSX.Element {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<ClientSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const userId = 'current-user';

  // Fetch session from API on mount
  useEffect(() => {
    const fetchSession = async () => {
      setIsLoading(true);
      setError(null);
      const result = await apiClient.sessions.get(sessionId);
      if (result.ok) {
        setSession(result.data as ClientSession);
      } else {
        setError({ message: result.error.message });
      }
      setIsLoading(false);
    };
    fetchSession();
  }, [sessionId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <div className="text-sm text-fg-muted">Loading session...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <EmptyState
          preset="error"
          title="Failed to load session"
          subtitle={error.message}
          action={{
            label: 'Try again',
            onClick: () => {
              void (async () => {
                setIsLoading(true);
                setError(null);
                const result = await apiClient.sessions.get(sessionId);
                if (result.ok) {
                  setSession(result.data as ClientSession);
                } else {
                  setError({ message: result.error.message });
                }
                setIsLoading(false);
              })();
            },
          }}
        />
      </div>
    );
  }

  if (!session) {
    return <div className="p-6 text-sm text-fg-muted">Session not found.</div>;
  }

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Sessions', to: '/sessions' }, { label: session.title ?? session.id }]}
    >
      <div className="relative h-full">
        {actionError && (
          <div className="absolute left-1/2 top-4 z-50 -translate-x-1/2 rounded-md border border-danger bg-danger/10 px-4 py-2 text-sm text-danger">
            {actionError}
          </div>
        )}
        <AgentSessionView
          sessionId={session.id}
          agentId={session.agentId ?? ''}
          userId={userId}
          onPause={async () => {
            if (session.agentId) {
              // TODO: Add API endpoint for agent pause
              try {
                await fetch(`/api/agents/${session.agentId}/pause`, { method: 'POST' });
              } catch {
                setActionError('Failed to pause agent');
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
          onResume={async () => {
            if (session.agentId) {
              // TODO: Add API endpoint for agent resume
              try {
                await fetch(`/api/agents/${session.agentId}/resume`, { method: 'POST' });
              } catch {
                setActionError('Failed to resume agent');
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
          onStop={async () => {
            if (session.agentId) {
              // TODO: Add API endpoint for agent stop
              try {
                await fetch(`/api/agents/${session.agentId}/stop`, { method: 'POST' });
              } catch {
                setActionError('Failed to stop agent');
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
        />
      </div>
    </LayoutShell>
  );
}
