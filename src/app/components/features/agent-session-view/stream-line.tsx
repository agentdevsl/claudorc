import {
  ArrowRight,
  CheckCircle,
  Info,
  Lightning,
  Terminal,
  WarningCircle,
} from '@phosphor-icons/react';
import { cn } from '@/lib/utils/cn';
import type { StreamLine as StreamLineData, StreamLineType } from './use-stream-parser';

interface StreamLineProps {
  line: StreamLineData;
  showTimestamp?: boolean;
}

const lineTypeConfig: Record<
  StreamLineType,
  {
    icon: React.ElementType;
    textClass: string;
    iconClass: string;
  }
> = {
  prompt: {
    icon: Terminal,
    textClass: 'text-success font-semibold',
    iconClass: 'text-success',
  },
  command: {
    icon: ArrowRight,
    textClass: 'text-fg',
    iconClass: 'text-fg-muted',
  },
  output: {
    icon: Info,
    textClass: 'text-fg-muted',
    iconClass: 'text-fg-subtle',
  },
  thinking: {
    icon: Lightning,
    textClass: 'text-warning italic',
    iconClass: 'text-warning',
  },
  action: {
    icon: ArrowRight,
    textClass: 'text-accent',
    iconClass: 'text-accent',
  },
  success: {
    icon: CheckCircle,
    textClass: 'text-success',
    iconClass: 'text-success',
  },
  error: {
    icon: WarningCircle,
    textClass: 'text-danger',
    iconClass: 'text-danger',
  },
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function StreamLine({ line, showTimestamp = true }: StreamLineProps): React.JSX.Element {
  const config = lineTypeConfig[line.type];
  const Icon = config.icon;

  return (
    <div className="group flex items-start gap-2 py-0.5 hover:bg-surface-subtle">
      {showTimestamp && (
        <span className="flex-shrink-0 w-16 text-xs text-fg-subtle font-mono tabular-nums">
          {formatTimestamp(line.timestamp)}
        </span>
      )}
      <span className={cn('flex-shrink-0 mt-0.5', config.iconClass)}>
        <Icon className="h-3.5 w-3.5" weight="bold" />
      </span>
      <span
        className={cn('flex-1 font-mono text-sm whitespace-pre-wrap break-all', config.textClass)}
      >
        {line.content}
      </span>
      {line.toolName && (
        <span className="flex-shrink-0 text-xs text-fg-subtle bg-surface-subtle px-1.5 py-0.5 rounded">
          {line.toolName}
        </span>
      )}
    </div>
  );
}

// Blinking cursor for active streaming
export function StreamCursor(): React.JSX.Element {
  return (
    <span
      className="inline-block w-2 h-4 bg-fg animate-pulse"
      style={{ animationDuration: '1s' }}
    />
  );
}
