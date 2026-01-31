import type { CliSession } from './cli-monitor-types';
import { TerminalPane } from './terminal-pane';

interface TerminalGridProps {
  paneAssignments: Map<number, string>;
  sessions: CliSession[];
}

export function TerminalGrid({ paneAssignments, sessions }: TerminalGridProps) {
  const getSession = (paneIndex: number): CliSession | null => {
    const sessionId = paneAssignments.get(paneIndex);
    if (!sessionId) return null;
    return sessions.find((s) => s.sessionId === sessionId) ?? null;
  };

  return (
    <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-px bg-emphasis overflow-hidden">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="group/pane min-h-0 min-w-0">
          <TerminalPane session={getSession(i)} paneIndex={i} />
        </div>
      ))}
    </div>
  );
}
