import { GitBranch } from '@phosphor-icons/react';
import type { CliSession } from './cli-monitor-types';

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
  const barClass = barStatusClass[session.status] ?? barStatusClass.idle;
  const dotClass = dotStatusClass[session.status] ?? 'bg-fg-subtle';
  const labelClass = labelStatusClass[session.status] ?? 'text-fg-subtle';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute h-10 rounded border cursor-pointer transition-transform flex items-center px-3 gap-2 overflow-hidden z-[5] animate-[slideInRight_0.4s_ease] hover:scale-y-[1.15] hover:z-[15] ${barClass} ${
        selected ? 'ring-2 ring-accent shadow-md z-[16]' : ''
      }`}
      style={{
        left: `${leftPercent}%`,
        width: `${Math.max(widthPercent, 2)}%`,
        top: row === 0 ? '6px' : '48px',
      }}
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
    </button>
  );
}
