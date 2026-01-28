import { Cube, CubeTransparent, Info, Spinner } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/app/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

export type ContainerStatus = 'stopped' | 'creating' | 'running' | 'idle' | 'error' | 'unavailable';

const statusDotVariants = cva('h-2 w-2 rounded-full', {
  variants: {
    status: {
      creating: 'bg-secondary animate-pulse',
      running: 'bg-success',
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
      return 'Online';
    case 'idle':
      return 'Idle';
    case 'stopped':
      return 'Offline';
    case 'error':
      return 'Error';
    case 'unavailable':
      return 'N/A';
    default:
      return status;
  }
}

function getStatusDescription(status: ContainerStatus): string {
  switch (status) {
    case 'creating':
      return 'Container is starting up...';
    case 'running':
      return 'Container is online and ready for agent tasks';
    case 'idle':
      return 'Container is online but idle (will auto-stop after timeout)';
    case 'stopped':
      return 'Container is offline. It will start automatically when an agent runs.';
    case 'error':
      return 'Container encountered an error';
    case 'unavailable':
      return 'Container status unavailable';
    default:
      return '';
  }
}

function getModeDescription(mode: 'shared' | 'per-project'): string {
  if (mode === 'shared') {
    return 'All projects share a single sandbox container';
  }
  return 'Each project has its own isolated sandbox container';
}

export interface SandboxIndicatorProps {
  mode: 'shared' | 'per-project';
  containerStatus: ContainerStatus;
  dockerAvailable: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * Sandbox status indicator for the title bar
 * Shows sandbox mode (shared/project) and container status with helpful tooltips
 */
export function SandboxIndicator({
  mode,
  containerStatus,
  dockerAvailable,
  isLoading = false,
  className,
}: SandboxIndicatorProps): React.JSX.Element {
  const isTransitioning = containerStatus === 'creating';
  const modeLabel = mode === 'shared' ? 'Shared' : 'Per-Project';

  if (!dockerAvailable) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'flex cursor-help items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5 text-xs text-fg-muted',
                className
              )}
            >
              <CubeTransparent className="h-4 w-4 opacity-50" />
              <span className="font-medium opacity-50">Sandbox</span>
              <span className="opacity-50">Unavailable</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[280px]">
            <p className="font-medium">Docker Not Available</p>
            <p className="mt-1 text-fg-muted">
              The sandbox requires Docker to run agent tasks in isolated containers. Please install
              and start Docker to enable sandbox features.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex cursor-help items-center gap-2 rounded-md border border-border bg-surface-subtle px-2.5 py-1.5',
              className
            )}
          >
            {/* Sandbox label with icon */}
            <div className="flex items-center gap-1.5 text-xs">
              <Cube className="h-4 w-4 text-fg-muted" />
              <span className="font-medium text-fg-muted">Sandbox</span>
            </div>

            {/* Divider */}
            <div className="h-4 w-px bg-border" />

            {/* Mode badge */}
            <span className="rounded bg-surface px-1.5 py-0.5 text-xs text-fg-muted">
              {modeLabel}
            </span>

            {/* Container status */}
            <div className="flex items-center gap-1.5">
              {isLoading || isTransitioning ? (
                <Spinner className="h-3.5 w-3.5 animate-spin text-secondary" />
              ) : (
                <div className={statusDotVariants({ status: containerStatus })} />
              )}
              <span
                className={cn(
                  'text-xs font-medium',
                  containerStatus === 'running' && 'text-success',
                  containerStatus === 'creating' && 'text-secondary',
                  containerStatus === 'error' && 'text-danger',
                  containerStatus === 'idle' && 'text-attention',
                  (containerStatus === 'stopped' || containerStatus === 'unavailable') &&
                    'text-fg-muted'
                )}
              >
                {getStatusLabel(containerStatus)}
              </span>
            </div>

            {/* Info icon hint */}
            <Info className="h-3.5 w-3.5 text-fg-muted opacity-50" />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[300px]">
          <div className="space-y-2">
            <div>
              <p className="font-medium">Sandbox Environment</p>
              <p className="mt-0.5 text-fg-muted">
                Agents run in isolated Docker containers for security.
              </p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-fg-muted">
                <span className="font-medium text-fg">Mode:</span> {modeLabel}
              </p>
              <p className="text-fg-muted">{getModeDescription(mode)}</p>
            </div>
            <div className="border-t border-border pt-2">
              <p className="text-fg-muted">
                <span className="font-medium text-fg">Status:</span>{' '}
                {getStatusLabel(containerStatus)}
              </p>
              <p className="text-fg-muted">{getStatusDescription(containerStatus)}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
