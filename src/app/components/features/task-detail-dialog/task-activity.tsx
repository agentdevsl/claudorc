import { ChatText, Check, Clock, File, Play, X } from '@phosphor-icons/react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { cn } from '@/lib/utils/cn';
import type { ActivityEntry } from './index';

interface TaskActivityProps {
  activities: ActivityEntry[];
  activeTab: 'timeline' | 'comments' | 'history';
  onTabChange: (tab: 'timeline' | 'comments' | 'history') => void;
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getActivityIcon(type: ActivityEntry['type']): React.ElementType {
  switch (type) {
    case 'status_change':
      return Play;
    case 'tool_call':
      return File;
    case 'comment':
      return ChatText;
    case 'rejection':
      return X;
    case 'approval':
      return Check;
    default:
      return Clock;
  }
}

function getActivityColor(type: ActivityEntry['type']): string {
  switch (type) {
    case 'status_change':
      return 'text-accent';
    case 'tool_call':
      return 'text-fg-muted';
    case 'comment':
      return 'text-fg';
    case 'rejection':
      return 'text-danger';
    case 'approval':
      return 'text-success';
    default:
      return 'text-fg-muted';
  }
}

interface ActivityItemProps {
  activity: ActivityEntry;
  isLast: boolean;
}

function ActivityItem({ activity, isLast }: ActivityItemProps): React.JSX.Element {
  const Icon = getActivityIcon(activity.type);
  const color = getActivityColor(activity.type);

  return (
    <div className="flex gap-3">
      {/* Timeline line and dot */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full',
            'bg-surface-muted border border-border'
          )}
        >
          <Icon className={cn('h-3 w-3', color)} />
        </div>
        {!isLast && <div className="w-px flex-1 bg-border" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 pb-4', isLast && 'pb-0')}>
        <p className="text-sm text-fg">{activity.message}</p>
        <span className="text-xs text-fg-subtle">{formatRelativeTime(activity.timestamp)}</span>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Clock className="h-8 w-8 text-fg-subtle mb-2" />
      <p className="text-sm text-fg-muted">{message}</p>
    </div>
  );
}

export function TaskActivity({
  activities,
  activeTab,
  onTabChange,
}: TaskActivityProps): React.JSX.Element {
  // Filter activities by type for each tab
  const timelineActivities = activities;
  const commentActivities = activities.filter((a) => a.type === 'comment');
  const historyActivities = activities.filter((a) => a.type === 'status_change');

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Activity</h3>

      <Tabs value={activeTab} onValueChange={(v) => onTabChange(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <div className="rounded-md border border-border bg-surface-subtle p-4">
            {timelineActivities.length > 0 ? (
              <div className="space-y-0">
                {timelineActivities.map((activity, index) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isLast={index === timelineActivities.length - 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No activity yet" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="comments">
          <div className="rounded-md border border-border bg-surface-subtle p-4">
            {commentActivities.length > 0 ? (
              <div className="space-y-0">
                {commentActivities.map((activity, index) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isLast={index === commentActivities.length - 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No comments yet" />
            )}
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="rounded-md border border-border bg-surface-subtle p-4">
            {historyActivities.length > 0 ? (
              <div className="space-y-0">
                {historyActivities.map((activity, index) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    isLast={index === historyActivities.length - 1}
                  />
                ))}
              </div>
            ) : (
              <EmptyState message="No state changes yet" />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
