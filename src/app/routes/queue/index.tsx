import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { QueueStatus } from '@/app/components/features/queue-status';
import { QueueWaitingState } from '@/app/components/features/queue-waiting-state';
import type { RouterContext } from '@/app/router';
import type { QueuePosition } from '@/services/agent.service';

export const Route = createFileRoute('/queue/')({
  loader: async ({ context }: { context: RouterContext }) => {
    if (!context.services) {
      return { queued: [] as QueuePosition[] };
    }

    const result = await context.services.agentService.getQueuedTasks();
    return { queued: result.ok ? result.value : [] };
  },
  component: QueuePage,
});

function QueuePage(): React.JSX.Element {
  const loaderData = Route.useLoaderData() as { queued: QueuePosition[] } | undefined;
  const [queued] = useState<QueuePosition[]>(loaderData?.queued ?? []);

  return (
    <LayoutShell breadcrumbs={[{ label: 'Queue' }]}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        {queued.length === 0 ? (
          <EmptyState
            preset="no-results"
            title="Queue is empty"
            subtitle="All agent capacity is currently available."
          />
        ) : (
          <>
            <QueueWaitingState
              position={queued[0]?.position ?? 1}
              estimatedWaitMinutes={queued[0]?.estimatedWaitMinutes}
            />
            <QueueStatus queued={queued} onOpenTask={() => {}} />
          </>
        )}
      </div>
    </LayoutShell>
  );
}
