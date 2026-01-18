import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { SessionHistory } from '@/app/components/features/session-history';
import type { RouterContext } from '@/app/router';
import type { SessionWithPresence } from '@/services/session.service';

export const Route = createFileRoute('/sessions/')({
  loader: async ({ context }: { context: RouterContext }) => {
    if (!context.services) {
      return { sessions: [] as SessionWithPresence[] };
    }

    try {
      const result = await context.services.sessionService.list();
      return { sessions: result.ok ? result.value : [] };
    } catch {
      // Database table may not exist yet
      return { sessions: [] as SessionWithPresence[] };
    }
  },
  component: SessionsPage,
});

function SessionsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData() as { sessions: SessionWithPresence[] } | undefined;
  const [sessions] = useState<SessionWithPresence[]>(loaderData?.sessions ?? []);

  return (
    <LayoutShell breadcrumbs={[{ label: 'Sessions' }]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {sessions.length === 0 ? (
          <EmptyState preset="empty-session" title="No sessions yet" />
        ) : (
          <SessionHistory
            sessions={sessions}
            onOpen={(sessionId) => navigate({ to: '/sessions/$sessionId', params: { sessionId } })}
          />
        )}
      </div>
    </LayoutShell>
  );
}
