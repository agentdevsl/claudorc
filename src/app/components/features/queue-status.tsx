import { Play } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import type { QueuePosition } from '@/services/agent.service';

interface QueueStatusProps {
  queued: QueuePosition[];
  onOpenTask: (taskId: string) => void;
}

export function QueueStatus({ queued, onOpenTask }: QueueStatusProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6" data-testid="queue-status">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg">Agent queue</h2>
          <p className="text-sm text-fg-muted">Tasks waiting for capacity.</p>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {queued.length === 0 ? (
          <p className="text-sm text-fg-muted">Queue is empty.</p>
        ) : (
          queued.map((item) => (
            <div
              key={item.taskId}
              className="flex items-center justify-between rounded-md border border-border bg-surface-subtle p-3"
            >
              <div>
                <p className="text-sm font-medium text-fg">Task {item.taskId.slice(0, 6)}</p>
                <p className="text-xs text-fg-muted">Position {item.position}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => onOpenTask(item.taskId)}>
                <Play className="h-3 w-3" />
                Open
              </Button>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
