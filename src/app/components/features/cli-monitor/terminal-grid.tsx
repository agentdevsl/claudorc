import { useState } from 'react';
import type { CliSession } from './cli-monitor-types';
import { TerminalPane } from './terminal-pane';

interface TerminalGridProps {
  paneAssignments: Map<number, string>;
  sessions: CliSession[];
}

function getGridLayout(assignedCount: number): { gridClass: string; paneIndices: number[] } {
  switch (assignedCount) {
    case 0:
      return { gridClass: '', paneIndices: [] };
    case 1:
      return { gridClass: 'grid grid-cols-1 grid-rows-1', paneIndices: [0] };
    case 2:
      return { gridClass: 'grid grid-cols-2 grid-rows-1', paneIndices: [0, 1] };
    case 3:
      return { gridClass: 'grid grid-cols-2 grid-rows-2', paneIndices: [0, 1, 2] };
    default:
      return { gridClass: 'grid grid-cols-2 grid-rows-2', paneIndices: [0, 1, 2, 3] };
  }
}

export function TerminalGrid({ paneAssignments, sessions }: TerminalGridProps) {
  const [maximizedPane, setMaximizedPane] = useState<number | null>(null);

  const getSession = (paneIndex: number): CliSession | null => {
    const sessionId = paneAssignments.get(paneIndex);
    if (!sessionId) return null;
    return sessions.find((s) => s.sessionId === sessionId) ?? null;
  };

  const handleToggleMaximize = (paneIndex: number) => {
    setMaximizedPane((prev) => (prev === paneIndex ? null : paneIndex));
  };

  const assignedPanes = [0, 1, 2, 3].filter((i) => paneAssignments.has(i));
  const assignedCount = assignedPanes.length;
  const { gridClass, paneIndices } = getGridLayout(assignedCount);

  if (maximizedPane !== null) {
    return (
      <div className="flex-1 bg-emphasis overflow-hidden animate-[scaleIn_0.2s_ease]">
        <div className="h-full group/pane">
          <TerminalPane
            session={getSession(maximizedPane)}
            paneIndex={maximizedPane}
            maximized
            onToggleMaximize={() => handleToggleMaximize(maximizedPane)}
          />
        </div>
      </div>
    );
  }

  if (assignedCount === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-emphasis text-muted">
        No active sessions
      </div>
    );
  }

  return (
    <div className={`flex-1 ${gridClass} gap-px bg-emphasis overflow-hidden`}>
      {assignedPanes.slice(0, paneIndices.length).map((paneIdx, i) => (
        <div
          key={paneIdx}
          className={`group/pane min-h-0 min-w-0 ${i === 0 && assignedCount === 3 ? 'col-span-2' : ''}`}
        >
          <TerminalPane
            session={getSession(paneIdx)}
            paneIndex={paneIdx}
            onToggleMaximize={() => handleToggleMaximize(paneIdx)}
          />
        </div>
      ))}
    </div>
  );
}
