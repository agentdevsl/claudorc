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
  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Session</p>
          <h1 className="text-lg font-semibold text-fg">{sessionId}</h1>
          <p className="text-xs text-fg-muted">Agent: {agentId}</p>
          <p className="text-xs text-fg-muted">User: {userId}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded bg-yellow-500 px-3 py-1.5 text-sm text-white hover:bg-yellow-600"
            onClick={() => void onPause()}
          >
            Pause
          </button>
          <button
            type="button"
            className="rounded bg-green-500 px-3 py-1.5 text-sm text-white hover:bg-green-600"
            onClick={() => void onResume()}
          >
            Resume
          </button>
          <button
            type="button"
            className="rounded bg-red-500 px-3 py-1.5 text-sm text-white hover:bg-red-600"
            onClick={() => void onStop()}
          >
            Stop
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto p-6">
        <div className="rounded-lg border border-border bg-surface p-4">
          <p className="text-sm text-fg-muted">Session output will appear here...</p>
        </div>
      </main>
    </div>
  );
}
