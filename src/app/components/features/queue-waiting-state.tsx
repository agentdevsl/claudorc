import { Hourglass, Timer } from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';

interface QueueWaitingStateProps {
  position: number;
  estimatedWaitMinutes?: number;
  className?: string;
}

export function QueueWaitingState({
  position,
  estimatedWaitMinutes,
  className,
}: QueueWaitingStateProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-surface p-6 text-center',
        className
      )}
    >
      <div className="rounded-full border border-border bg-surface-muted p-3">
        <Hourglass className="h-6 w-6 text-attention" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-fg">Queued for an agent</h3>
        <p className="text-xs text-fg-muted">Position {position} in queue</p>
      </div>
      {estimatedWaitMinutes !== undefined && (
        <div className="flex items-center gap-2 text-xs text-fg-muted">
          <Timer className="h-3.5 w-3.5" />
          <span>Estimated wait {estimatedWaitMinutes} min</span>
        </div>
      )}
    </div>
  );
}
