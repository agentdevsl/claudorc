import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { SessionHistory } from '@/app/components/features/session-history';
import { apiClient } from '@/lib/api/client';

// Session type for client-side display
type ClientSession = {
  id: string;
  agentId: string;
  status: string;
  startedAt: Date | null;
  endedAt?: Date | null;
  presence?: { active: boolean };
};

export const Route = createFileRoute('/sessions/')({
  component: SessionsPage,
});

function SessionsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<ClientSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch sessions from API on mount
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const result = await apiClient.sessions.list();
        if (result.ok) {
          setSessions(result.data.items as ClientSession[]);
        }
      } catch {
        // API may not be ready yet
      }
      setIsLoading(false);
    };
    fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Sessions' }]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading sessions...</div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell breadcrumbs={[{ label: 'Sessions' }]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {sessions.length === 0 ? (
          <EmptyState preset="empty-session" title="No sessions yet" />
        ) : (
          <SessionHistory
            sessions={sessions as Parameters<typeof SessionHistory>[0]['sessions']}
            onOpen={(sessionId) => navigate({ to: '/sessions/$sessionId', params: { sessionId } })}
          />
        )}
      </div>
    </LayoutShell>
  );
}
