import { Cube, CubeTransparent, Spinner } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

export type ContainerStatus = 'stopped' | 'creating' | 'running' | 'idle' | 'error' | 'unavailable';

const statusDotVariants = cva('h-1.5 w-1.5 rounded-full', {
  variants: {
    status: {
      creating: 'bg-secondary animate-pulse',
      running: 'bg-success animate-pulse',
      idle: 'bg-attention',
      stopped: 'bg-fg-muted',
      error: 'bg-danger',
      unavailable: 'bg-fg-muted opacity-50',
    },
  },
  defaultVariants: {
    status: 'stopped',
  },
});

function getStatusLabel(status: ContainerStatus): string {
  switch (status) {
    case 'creating':
      return 'Starting';
    case 'running':
      return 'Running';
    case 'idle':
      return 'Idle';
    case 'stopped':
      return 'Stopped';
    case 'error':
      return 'Error';
    case 'unavailable':
      return 'N/A';
    default:
      return status;
  }
}

export interface SandboxIndicatorProps {
  mode: 'shared' | 'per-project';
  containerStatus: ContainerStatus;
  dockerAvailable: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Compact sandbox status indicator for the title bar
 * Shows sandbox mode (shared/project) and container status
 */
export function SandboxIndicator({
  mode,
  containerStatus,
  dockerAvailable,
  isLoading = false,
  className,
}: SandboxIndicatorProps): React.JSX.Element {
  const isTransitioning = containerStatus === 'creating';
  const modeLabel = mode === 'shared' ? 'Shared' : 'Project';

  if (!dockerAvailable) {
    return (
      <div
        className={cn(
          'flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs text-fg-muted',
          className
        )}
        title="Docker not available"
      >
        <CubeTransparent className="h-3.5 w-3.5 opacity-50" />
        <span className="opacity-50">No Docker</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5',
        className
      )}
      title={`Sandbox: ${modeLabel} mode, Container: ${getStatusLabel(containerStatus)}`}
    >
      {/* Sandbox mode icon */}
      <div className="flex items-center gap-1 text-xs text-fg-muted">
        <Cube className="h-3.5 w-3.5" />
        <span>{modeLabel}</span>
      </div>

      {/* Divider */}
      <div className="h-3 w-px bg-border" />

      {/* Container status */}
      <div className="flex items-center gap-1.5">
        {isLoading || isTransitioning ? (
          <Spinner className="h-3 w-3 animate-spin text-secondary" />
        ) : (
          <div className={statusDotVariants({ status: containerStatus })} />
        )}
        <span
          className={cn(
            'text-xs',
            containerStatus === 'running' && 'text-success',
            containerStatus === 'error' && 'text-danger',
            containerStatus === 'idle' && 'text-attention',
            (containerStatus === 'stopped' || containerStatus === 'unavailable') && 'text-fg-muted'
          )}
        >
          {getStatusLabel(containerStatus)}
        </span>
      </div>
    </div>
  );
}
