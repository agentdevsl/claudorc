import { Pause, Play, Square, TerminalWindow } from '@phosphor-icons/react';
import { Button } from '@/app/components/ui/button';
import { EmptyState } from '@/app/components/features/empty-state';
import { useAgentStream } from '@/app/hooks/use-agent-stream';
import { useSession } from '@/app/hooks/use-session';
import { usePresence } from '@/app/hooks/use-presence';

interface AgentSessionViewProps {
  sessionId: string;
  agentId: string;
  userId: string;
  onPause: () => Promise<void>;
  onResume: () => Promise<void>;
  onStop: () => Promise<void>;
}

export function AgentSessionView({
  sessionId,
  agentId,
  userId,
  onPause,
  onResume,
  onStop,
}: AgentSessionViewProps): React.JSX.Element {
  const { state } = useSession(sessionId, userId);
  const { fullText, isStreaming } = useAgentStream(sessionId);
  const { users } = usePresence(sessionId, userId);

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Session</p>
          <h1 className="text-lg font-semibold text-fg">{sessionId}</h1>
          <p className="text-xs text-fg-muted">Agent: {agentId || 'Unassigned'}</p>
          <p className="text-xs text-fg-muted">Active: {users.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => void onPause()}>
            <Pause className="h-4 w-4" />
            Pause
          </Button>
          <Button variant="outline" onClick={() => void onResume()}>
            <Play className="h-4 w-4" />
            Resume
          </Button>
          <Button variant="destructive" onClick={() => void onStop()}>
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-sm text-fg-muted">
            <TerminalWindow className="h-4 w-4" />
            {isStreaming ? 'Streaming output...' : 'Latest output'}
          </div>
          {state.chunks.length === 0 ? (
            <div className="py-10">
              <EmptyState
                preset="empty-session"
                size="sm"
                title="Waiting for output"
                subtitle="Agent messages will appear in real time."
              />
            </div>
          ) : (
            <pre className="mt-4 whitespace-pre-wrap text-sm text-fg">{fullText}</pre>
          )}
        </div>
      </main>
    </div>
  );
}
