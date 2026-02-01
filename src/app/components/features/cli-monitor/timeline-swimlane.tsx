import { useMemo } from 'react';
import type { CliSession } from './cli-monitor-types';
import { type ProjectGroup, TimelineLabels } from './timeline-labels';
import { TimelineSessionBar } from './timeline-session-bar';
import { TimelineTimeAxis, type TimeRange, useTimelineCalculations } from './timeline-time-axis';

interface TimelineSwimlaneProps {
  sessions: CliSession[];
  timeRange: TimeRange;
  selectedSessionId: string | null;
  onSelectSession: (id: string | null) => void;
}

export function TimelineSwimlane({
  sessions,
  timeRange,
  selectedSessionId,
  onSelectSession,
}: TimelineSwimlaneProps) {
  const { startTime, toPercent } = useTimelineCalculations(timeRange);
  const now = Date.now();
  const nowPercent = 100; // NOW is always at the right edge

  // Group sessions by project
  const projectGroups = useMemo(() => {
    const groups = new Map<string, CliSession[]>();
    for (const s of sessions) {
      if (s.isSubagent) continue;
      const key = s.projectName || 'Unknown';
      const arr = groups.get(key) || [];
      arr.push(s);
      groups.set(key, arr);
    }
    return groups;
  }, [sessions]);

  const projectLabels: ProjectGroup[] = useMemo(() => {
    return Array.from(projectGroups.entries()).map(([name, groupSessions]) => ({
      name,
      path: groupSessions[0]?.cwd ?? '',
      sessionCount: groupSessions.length,
    }));
  }, [projectGroups]);

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* Y-axis labels */}
      <TimelineLabels groups={projectLabels} />

      {/* Timeline area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden relative">
        <div className="min-w-[1200px] relative">
          {/* Time axis */}
          <TimelineTimeAxis timeRange={timeRange} nowPercent={nowPercent} />

          {/* Swimlane rows */}
          {Array.from(projectGroups.entries()).map(([projectName, projectSessions], idx) => (
            <div
              key={projectName}
              className={`h-[76px] border-b border-border relative flex items-center py-3 hover:bg-white/[0.015] ${
                idx % 2 === 0 ? 'bg-white/[0.02]' : ''
              }`}
            >
              {projectSessions.map((session, i) => {
                const sessionStart = Math.max(session.startedAt, startTime);
                const sessionEnd = session.status === 'idle' ? session.lastActivityAt : now;
                const left = toPercent(sessionStart);
                const right = toPercent(Math.min(sessionEnd, now));
                const width = right - left;

                if (left > 100 || right < 0) return null;

                return (
                  <TimelineSessionBar
                    key={session.sessionId}
                    session={session}
                    leftPercent={Math.max(left, 0)}
                    widthPercent={Math.min(width, 100 - Math.max(left, 0))}
                    row={i % 2}
                    selected={session.sessionId === selectedSessionId}
                    onClick={() =>
                      onSelectSession(
                        session.sessionId === selectedSessionId ? null : session.sessionId
                      )
                    }
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
