import { Circle, Cube, Spinner } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

/**
 * Sandbox status values
 */
export type SandboxStatus =
  | 'creating'
  | 'ready'
  | 'running'
  | 'idle'
  | 'stopping'
  | 'stopped'
  | 'error';

const statusVariants = cva(
  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
  {
    variants: {
      status: {
        creating: 'bg-secondary-muted text-secondary',
        ready: 'bg-success-muted text-success',
        running: 'bg-attention-muted text-attention',
        idle: 'bg-surface-muted text-fg-muted',
        stopping: 'bg-attention-muted text-attention',
        stopped: 'bg-surface-muted text-fg-muted',
        error: 'bg-danger-muted text-danger',
      },
    },
    defaultVariants: {
      status: 'stopped',
    },
  }
);

const statusDotVariants = cva('h-2 w-2 rounded-full', {
  variants: {
    status: {
      creating: 'bg-secondary animate-pulse',
      ready: 'bg-success',
      running: 'bg-attention animate-pulse',
      idle: 'bg-fg-muted',
      stopping: 'bg-attention animate-pulse',
      stopped: 'bg-fg-muted',
      error: 'bg-danger',
    },
  },
  defaultVariants: {
    status: 'stopped',
  },
});

function getStatusLabel(status: SandboxStatus): string {
  switch (status) {
    case 'creating':
      return 'Creating...';
    case 'ready':
      return 'Ready';
    case 'running':
      return 'Running';
    case 'idle':
      return 'Idle';
    case 'stopping':
      return 'Stopping...';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Error';
    default:
      return status;
  }
}

export interface SandboxStatusProps {
  status: SandboxStatus;
  sandboxId?: string;
  image?: string;
  className?: string;
  showIcon?: boolean;
  compact?: boolean;
}

/**
 * Sandbox status indicator component
 */
export function SandboxStatus({
  status,
  sandboxId,
  image,
  className,
  showIcon = true,
  compact = false,
}: SandboxStatusProps): React.JSX.Element {
  const isLoading = status === 'creating' || status === 'stopping';

  if (compact) {
    return (
      <div
        className={cn('flex items-center gap-2', className)}
        title={`Sandbox: ${getStatusLabel(status)}${sandboxId ? ` (${sandboxId})` : ''}`}
      >
        {isLoading ? (
          <Spinner className="h-4 w-4 text-secondary animate-spin" />
        ) : (
          <div className={statusDotVariants({ status })} />
        )}
        {!compact && <span className="text-xs text-fg-muted">Sandbox</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {showIcon && (
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-surface-muted">
          <Cube className="h-4 w-4 text-fg-muted" />
        </div>
      )}
      <div className="flex flex-col">
        <span className={statusVariants({ status })}>
          {isLoading ? (
            <Spinner className="h-3 w-3 animate-spin" />
          ) : (
            <Circle weight="fill" className="h-2 w-2" />
          )}
          {getStatusLabel(status)}
        </span>
        {(sandboxId || image) && (
          <div className="flex items-center gap-2 mt-0.5">
            {sandboxId && (
              <span className="text-xs text-fg-muted font-mono">{sandboxId.slice(0, 8)}</span>
            )}
            {image && <span className="text-xs text-fg-muted">{image}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Compact inline sandbox status badge
 */
export function SandboxStatusBadge({
  status,
  className,
}: {
  status: SandboxStatus;
  className?: string;
}): React.JSX.Element {
  const isLoading = status === 'creating' || status === 'stopping';

  return (
    <span className={cn(statusVariants({ status }), className)}>
      {isLoading ? (
        <Spinner className="h-3 w-3 animate-spin" />
      ) : (
        <div className={statusDotVariants({ status })} />
      )}
      {getStatusLabel(status)}
    </span>
  );
}
