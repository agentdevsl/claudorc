import type { AggregateStatus } from './cli-monitor-types';

export function StatusIndicator({ status }: { status: AggregateStatus }) {
  const config = {
    nominal: {
      label: 'LIVE',
      dotClass: 'bg-success animate-pulse',
      bgClass: 'bg-success/15 text-success',
    },
    attention: {
      label: 'WAITING',
      dotClass: 'bg-attention',
      bgClass: 'bg-attention/15 text-attention',
    },
    idle: { label: 'IDLE', dotClass: 'bg-fg-subtle', bgClass: 'bg-muted text-fg-muted' },
  }[status];

  return (
    <div
      className={`flex items-center gap-2 rounded px-3 py-1 text-xs font-semibold ${config.bgClass}`}
    >
      <span className={`h-2 w-2 rounded-full ${config.dotClass}`} />
      {config.label}
    </div>
  );
}
