import { Clock, Play } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import type { SessionWithPresence } from '@/services/session.service';

interface SessionHistoryProps {
  sessions: SessionWithPresence[];
  onOpen: (sessionId: string) => void;
}

export function SessionHistory({ sessions, onOpen }: SessionHistoryProps): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border bg-surface p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-muted">
            <Clock className="h-5 w-5 text-fg-muted" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-fg">Session history</h2>
            <p className="text-sm text-fg-muted">Review recent agent runs and outputs.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-fg-muted">No sessions yet.</p>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-surface-subtle p-3"
            >
              <div>
                <p className="text-sm font-medium text-fg">{session.title ?? 'Untitled session'}</p>
                <p className="text-xs text-fg-muted">{session.status}</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-fg-muted">
                <span>{session.presence.length} active</span>
                <Button size="sm" variant="outline" onClick={() => onOpen(session.id)}>
                  <Play className="h-3 w-3" />
                  Open
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
