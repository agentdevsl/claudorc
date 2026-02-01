import { GitBranch } from '@phosphor-icons/react';
import { useState } from 'react';
import type { CliSession } from './cli-monitor-types';
import { estimateCost, formatTokenCount, getSessionTokenTotal } from './cli-monitor-utils';

const barStatusClass: Record<string, string> = {
  working: 'bg-gradient-to-r from-success/30 to-success/15 border-success/40',
  waiting_for_approval: 'bg-gradient-to-r from-attention/30 to-attention/15 border-attention/40',
  waiting_for_input: 'bg-gradient-to-r from-accent/30 to-accent/15 border-accent/40',
  idle: 'bg-gradient-to-r from-fg-subtle/20 to-fg-subtle/[0.08] border-fg-subtle/30',
};

const dotStatusClass: Record<string, string> = {
  working: 'bg-success animate-pulse',
  waiting_for_approval: 'bg-attention',
  waiting_for_input: 'bg-accent',
  idle: 'bg-fg-subtle',
};

const labelStatusClass: Record<string, string> = {
  working: 'text-success',
  waiting_for_approval: 'text-attention',
  waiting_for_input: 'text-accent',
  idle: 'text-fg-subtle',
};

const statusBadgeClass: Record<string, string> = {
  working: 'bg-success/15 text-success',
  waiting_for_approval: 'bg-attention/15 text-attention',
  waiting_for_input: 'bg-accent/15 text-accent',
  idle: 'bg-emphasis text-fg-muted',
};

const statusLabel: Record<string, string> = {
  working: 'Working',
  waiting_for_approval: 'Approval',
  waiting_for_input: 'Input',
  idle: 'Idle',
};

interface TimelineSessionBarProps {
  session: CliSession;
  leftPercent: number;
  widthPercent: number;
  row: number;
  selected: boolean;
  onClick: () => void;
}

export function TimelineSessionBar({
  session,
  leftPercent,
  widthPercent,
  row,
  selected,
  onClick,
}: TimelineSessionBarProps) {
  const [hovered, setHovered] = useState(false);
  const barClass = barStatusClass[session.status] ?? barStatusClass.idle;
  const dotClass = dotStatusClass[session.status] ?? 'bg-fg-subtle';
  const labelClass = labelStatusClass[session.status] ?? 'text-fg-subtle';
  const badgeClass = statusBadgeClass[session.status] ?? 'bg-emphasis text-fg-muted';
  const label = statusLabel[session.status] ?? 'Idle';
  const totalTokens = getSessionTokenTotal(session);
  const durationMs = Date.now() - session.startedAt;
  const durationMin = Math.floor(durationMs / 60000);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: wrapper for positioning and hover state
    <div
      className="absolute z-[5]"
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 2)}%`,
        top: row === 0 ? '6px' : '48px',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        type="button"
        onClick={onClick}
        className={`h-10 w-full rounded border cursor-pointer transition-transform flex items-center px-3 gap-2 overflow-hidden animate-[slideInRight_0.4s_ease] hover:scale-y-[1.15] hover:z-[15] ${barClass} ${
          selected ? 'ring-2 ring-accent shadow-md z-[16]' : ''
        }`}
      >
        {/* Shimmer overlay for working */}
        {session.status === 'working' && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-success/15 to-transparent bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]" />
        )}
        <span className={`relative z-[2] h-[7px] w-[7px] rounded-full shrink-0 ${dotClass}`} />
        <span
          className={`relative z-[2] text-[11px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis ${labelClass}`}
        >
          {session.goal || session.sessionId.slice(0, 7)}
        </span>
        <span className="relative z-[2] text-[10px] font-mono text-fg-subtle whitespace-nowrap">
          {session.sessionId.slice(0, 7)}
        </span>
        {session.gitBranch && (
          <span className="relative z-[2] ml-auto flex items-center gap-0.5 text-[10px] font-mono text-[#a371f7] px-1.5 bg-[#a371f7]/15 rounded whitespace-nowrap">
            <GitBranch size={10} />
            {session.gitBranch}
          </span>
        )}
        {session.performanceMetrics && session.performanceMetrics.healthStatus !== 'healthy' && (
          <span
            className={`relative z-[2] ml-1 h-[6px] w-[6px] rounded-full shrink-0 ${
              session.performanceMetrics.healthStatus === 'critical'
                ? 'bg-danger animate-pulse'
                : 'bg-attention'
            }`}
          />
        )}
        {/* Compaction tick marks */}
        {session.performanceMetrics?.compactionEvents?.map((evt) => {
          const elapsed = evt.timestamp - session.startedAt;
          const total =
            (session.status === 'idle' ? session.lastActivityAt : Date.now()) - session.startedAt;
          if (total <= 0) return null;
          const pct = Math.min(Math.max((elapsed / total) * 100, 0), 100);
          return (
            <span
              key={`${evt.timestamp}-${evt.type}`}
              className="absolute z-[3] h-[6px] w-[6px] bg-attention rotate-45 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ left: `${pct}%` }}
            />
          );
        })}
      </button>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute left-0 top-full mt-1 z-50 w-[280px] rounded-lg border border-border bg-default p-3 shadow-lg transition-opacity duration-150">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-mono text-xs font-medium text-fg">
              {session.sessionId.slice(0, 8)}
            </span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${badgeClass}`}>
              {label}
            </span>
          </div>
          {session.goal && (
            <p className="text-xs text-fg-muted line-clamp-2 mb-2">{session.goal}</p>
          )}
          <div className="flex items-center gap-3 text-[11px] text-fg-subtle">
            <span>{session.messageCount} msgs</span>
            <span className="font-mono">{formatTokenCount(totalTokens)} tokens</span>
            <span className="font-mono text-fg-muted">
              ${estimateCost(session).toFixed(2)} est.
            </span>
            <span>{durationMin}m</span>
          </div>
          {session.performanceMetrics && (
            <>
              <div className="flex items-center gap-2 text-[11px] text-fg-subtle mt-1 pt-1 border-t border-border">
                <span>
                  Context: {Math.round(session.performanceMetrics.contextPressure * 100)}%
                </span>
                <span>·</span>
                <span>Cache: {Math.round(session.performanceMetrics.cacheHitRatio * 100)}%</span>
                <span>·</span>
                <span>{session.performanceMetrics.compactionCount} compactions</span>
              </div>
              {/* Context pressure mini-bar */}
              <div className="h-1 w-full rounded-full bg-emphasis mt-1.5">
                <div
                  className={`h-full rounded-full transition-all ${
                    session.performanceMetrics.contextPressure > 0.9
                      ? 'bg-danger'
                      : session.performanceMetrics.contextPressure > 0.7
                        ? 'bg-attention'
                        : 'bg-success'
                  }`}
                  style={{
                    width: `${Math.round(session.performanceMetrics.contextPressure * 100)}%`,
                  }}
                />
              </div>
              {/* Compaction events */}
              {session.performanceMetrics.compactionEvents?.length > 0 && (
                <div className="mt-1.5 pt-1 border-t border-border space-y-0.5">
                  {session.performanceMetrics.compactionEvents.slice(-3).map((evt) => (
                    <div
                      key={`${evt.timestamp}-${evt.type}`}
                      className="flex items-center gap-1.5 text-[10px] text-fg-subtle"
                    >
                      <span
                        className={`h-[5px] w-[5px] rounded-full shrink-0 ${
                          evt.type === 'compact' ? 'bg-attention' : 'bg-accent'
                        }`}
                      />
                      <span className="capitalize">
                        {evt.type === 'microcompact' ? 'Micro' : 'Compact'}
                      </span>
                      <span className="ml-auto font-mono text-fg-subtle/70">
                        {new Date(evt.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
