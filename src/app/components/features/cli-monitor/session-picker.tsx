import type { CliSession } from './cli-monitor-types';

const dotClass: Record<string, string> = {
  working: 'bg-success',
  waiting_for_approval: 'bg-attention',
  waiting_for_input: 'bg-accent',
  idle: 'bg-fg-subtle',
};

interface SessionPickerProps {
  sessions: CliSession[];
  paneAssignments: Map<number, string>;
  onAssign: (sessionId: string) => void;
}

export function SessionPicker({ sessions, paneAssignments, onAssign }: SessionPickerProps) {
  const assignedIds = new Set(paneAssignments.values());
  const assignedMap = new Map<string, number>();
  for (const [pane, sid] of paneAssignments) {
    assignedMap.set(sid, pane);
  }

  const nonSubagents = sessions.filter((s) => !s.isSubagent);
  const assigned = nonSubagents.filter((s) => assignedIds.has(s.sessionId));
  const unassigned = nonSubagents.filter((s) => !assignedIds.has(s.sessionId));

  return (
    <div className="fixed bottom-[44px] right-4 w-[260px] bg-default border border-border rounded-xl shadow-lg z-50 overflow-hidden animate-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-subtle">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Session Panes
        </span>
        <span className="text-[10px] text-fg-subtle">Click to assign</span>
      </div>
      <div className="p-1 max-h-[200px] overflow-y-auto">
        {assigned.map((s) => (
          <button
            key={s.sessionId}
            type="button"
            onClick={() => onAssign(s.sessionId)}
            className="flex w-full items-center gap-2 px-2 py-2 rounded text-left bg-accent/15 transition-colors hover:bg-accent/25"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass[s.status] ?? 'bg-fg-subtle'}`}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-px">
              <span className="font-mono text-[11px] font-medium text-fg">
                {s.sessionId.slice(0, 7)}
              </span>
              <span className="text-[10px] text-fg-subtle truncate">{s.goal || s.projectName}</span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-accent shrink-0">
              #{(assignedMap.get(s.sessionId) ?? 0) + 1}
            </span>
          </button>
        ))}
        {unassigned.length > 0 && assigned.length > 0 && (
          <div className="border-t border-border mt-1 pt-1" />
        )}
        {unassigned.map((s) => (
          <button
            key={s.sessionId}
            type="button"
            onClick={() => onAssign(s.sessionId)}
            className="flex w-full items-center gap-2 px-2 py-2 rounded text-left transition-colors hover:bg-subtle"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotClass[s.status] ?? 'bg-fg-subtle'}`}
            />
            <div className="flex-1 min-w-0 flex flex-col gap-px">
              <span className="font-mono text-[11px] font-medium text-fg">
                {s.sessionId.slice(0, 7)}
              </span>
              <span className="text-[10px] text-fg-subtle truncate">{s.goal || s.projectName}</span>
            </div>
            <span className="text-[10px] text-fg-subtle">unassigned</span>
          </button>
        ))}
        {nonSubagents.length === 0 && (
          <div className="px-2 py-3 text-xs text-fg-subtle text-center">No sessions available</div>
        )}
      </div>
    </div>
  );
}
