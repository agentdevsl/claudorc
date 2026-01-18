import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AgentSessionView } from '@/app/components/features/agent-session-view';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import type { RouterContext } from '@/app/router';
import { useServices } from '@/app/services/service-context';
import type { AppError } from '@/lib/errors/base';
import type { SessionWithPresence } from '@/services/session.service';

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: async ({
    context,
    params,
  }: {
    context: RouterContext;
    params: { sessionId: string };
  }) => {
    if (!context.services) {
      return { session: null as SessionWithPresence | null };
    }

    const result = await context.services.sessionService.getById(params.sessionId);
    return { session: result.ok ? result.value : null };
  },
  component: SessionPage,
});

function SessionPage(): React.JSX.Element {
  const loaderData = Route.useLoaderData() as { session: SessionWithPresence | null } | undefined;
  const { sessionService, agentService } = useServices();
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<SessionWithPresence | null>(loaderData?.session ?? null);
  const [isLoading, setIsLoading] = useState(!loaderData?.session);
  const [error, setError] = useState<AppError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const userId = 'current-user';

  useEffect(() => {
    if (!session) {
      const load = async () => {
        setIsLoading(true);
        setError(null);
        const result = await sessionService.getById(sessionId);
        if (result.ok) {
          setSession(result.value);
        } else {
          console.error('Failed to load session:', result.error);
          setError(result.error);
        }
        setIsLoading(false);
      };

      void load();
    }
  }, [session, sessionId, sessionService]);

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
                const result = await sessionService.getById(sessionId);
                if (result.ok) {
                  setSession(result.value);
                } else {
                  console.error('Failed to load session:', result.error);
                  setError(result.error);
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
              const result = await agentService.pause(session.agentId);
              if (!result.ok) {
                console.error('Failed to pause agent:', result.error);
                setActionError(`Failed to pause: ${result.error.message}`);
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
          onResume={async () => {
            if (session.agentId) {
              const result = await agentService.resume(session.agentId);
              if (!result.ok) {
                console.error('Failed to resume agent:', result.error);
                setActionError(`Failed to resume: ${result.error.message}`);
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
          onStop={async () => {
            if (session.agentId) {
              const result = await agentService.stop(session.agentId);
              if (!result.ok) {
                console.error('Failed to stop agent:', result.error);
                setActionError(`Failed to stop: ${result.error.message}`);
                setTimeout(() => setActionError(null), 5000);
              }
            }
          }}
        />
      </div>
    </LayoutShell>
  );
}
