import {
  ArrowBendUpRight,
  ArrowCircleRight,
  CheckCircle,
  Download,
  Eye,
  SignIn,
  SignOut,
  WarningCircle,
  XCircle,
} from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import { Button } from '@/app/components/ui/button';

// Activity item types
export type ActivityItemType =
  | 'join' // User joined session
  | 'leave' // User left session
  | 'watch' // User watching
  | 'start' // Session started
  | 'pause' // Agent paused
  | 'resume' // Agent resumed
  | 'complete' // Agent completed
  | 'error'; // Error occurred

export interface ActivityItem {
  id: string;
  type: ActivityItemType;
  userId?: string;
  displayName?: string;
  message: string;
  timestamp: number;
}

interface ActivitySidebarProps {
  items: ActivityItem[];
  onLeaveSession: () => void;
  onEndSession: () => void;
  onExportLogs?: () => void;
  onRestartSession?: () => void;
  canEndSession: boolean;
  sessionMetadata?: {
    projectName?: string;
    agentName?: string;
    startedAt?: number;
  };
}

const activityIconVariants = cva('flex h-8 w-8 items-center justify-center rounded-full', {
  variants: {
    type: {
      join: 'bg-success/15 text-success',
      leave: 'bg-surface-subtle text-fg-muted',
      watch: 'bg-accent/15 text-accent',
      start: 'bg-accent/15 text-accent',
      pause: 'bg-warning/15 text-warning',
      resume: 'bg-success/15 text-success',
      complete: 'bg-success/15 text-success',
      error: 'bg-danger/15 text-danger',
    },
  },
  defaultVariants: {
    type: 'start',
  },
});

const activityIcons: Record<ActivityItemType, React.ElementType> = {
  join: SignIn,
  leave: SignOut,
  watch: Eye,
  start: ArrowCircleRight,
  pause: XCircle,
  resume: ArrowBendUpRight,
  complete: CheckCircle,
  error: WarningCircle,
};

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) {
    return 'Just now';
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`;
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ActivityItemRow({ item }: { item: ActivityItem }): React.JSX.Element {
  const Icon = activityIcons[item.type];

  return (
    <div className="flex items-start gap-3 py-2">
      <div className={activityIconVariants({ type: item.type })}>
        <Icon className="h-4 w-4" weight="bold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-fg">
          {item.displayName && <span className="font-medium">{item.displayName} </span>}
          {item.message}
        </p>
        <p className="text-xs text-fg-muted">{formatTimestamp(item.timestamp)}</p>
      </div>
    </div>
  );
}

export function ActivitySidebar({
  items,
  onLeaveSession,
  onEndSession,
  onExportLogs,
  onRestartSession,
  canEndSession,
  sessionMetadata,
}: ActivitySidebarProps): React.JSX.Element {
  return (
    <aside className="flex w-80 flex-col border-l border-border bg-surface">
      {/* Header */}
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-fg">Activity</h2>
      </div>

      {/* Session metadata */}
      {sessionMetadata && (
        <div className="border-b border-border px-4 py-3 space-y-2">
          {sessionMetadata.projectName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Project</span>
              <span className="text-fg font-medium">{sessionMetadata.projectName}</span>
            </div>
          )}
          {sessionMetadata.agentName && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Agent</span>
              <span className="text-fg font-medium">{sessionMetadata.agentName}</span>
            </div>
          )}
          {sessionMetadata.startedAt && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">Started</span>
              <span className="text-fg">{formatTimestamp(sessionMetadata.startedAt)}</span>
            </div>
          )}
        </div>
      )}

      {/* Activity feed */}
      <div className="flex-1 overflow-y-auto px-4">
        {items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-fg-muted">No activity yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {items.map((item) => (
              <ActivityItemRow key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Session actions */}
      <div className="border-t border-border p-4 space-y-2">
        {onExportLogs && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onExportLogs}
          >
            <Download className="h-4 w-4" />
            Export Logs
          </Button>
        )}
        {onRestartSession && (
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start"
            onClick={onRestartSession}
          >
            <ArrowBendUpRight className="h-4 w-4" />
            Restart Session
          </Button>
        )}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onLeaveSession}>
            Leave
          </Button>
          {canEndSession && (
            <Button variant="destructive" size="sm" className="flex-1" onClick={onEndSession}>
              End Session
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
