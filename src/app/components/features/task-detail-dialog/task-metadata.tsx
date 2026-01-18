import { CalendarBlank, Clock, FileCode, GitBranch, Hash } from '@phosphor-icons/react';
import type { Task } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';

interface TaskMetadataProps {
  task: Task;
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

interface MetadataItemProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  tooltip?: string;
  className?: string;
}

function MetadataItem({
  label,
  value,
  icon: Icon,
  tooltip,
  className,
}: MetadataItemProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col gap-1', className)} title={tooltip}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-fg-subtle">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-sm text-fg">
        <Icon className="h-3.5 w-3.5 text-fg-muted" />
        <span>{value}</span>
      </div>
    </div>
  );
}

export function TaskMetadata({ task }: TaskMetadataProps): React.JSX.Element {
  // Extract additional metadata from diffSummary if available
  const diffSummary = task.diffSummary as {
    filesChanged?: number;
    linesAdded?: number;
    linesRemoved?: number;
    turnCount?: number;
  } | null;

  const filesChanged = diffSummary?.filesChanged ?? 0;
  const linesAdded = diffSummary?.linesAdded ?? 0;
  const linesRemoved = diffSummary?.linesRemoved ?? 0;
  const turnCount = diffSummary?.turnCount ?? 0;

  const fileChangesDisplay =
    filesChanged > 0 ? `${filesChanged} (+${linesAdded} / -${linesRemoved})` : '-';

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-fg-muted">Metadata</h3>

      <div className="grid grid-cols-2 gap-4 rounded-md border border-border bg-surface-subtle p-4 sm:grid-cols-3">
        <MetadataItem
          label="Created"
          value={formatRelativeTime(task.createdAt)}
          icon={CalendarBlank}
          tooltip={formatDate(task.createdAt)}
        />
        <MetadataItem
          label="Started"
          value={formatRelativeTime(task.startedAt)}
          icon={Clock}
          tooltip={task.startedAt ? formatDate(task.startedAt) : undefined}
        />
        <MetadataItem
          label="Completed"
          value={formatRelativeTime(task.completedAt)}
          icon={Clock}
          tooltip={task.completedAt ? formatDate(task.completedAt) : undefined}
        />
        <MetadataItem label="Agent Turns" value={turnCount || '-'} icon={Hash} />
        <MetadataItem label="Files Changed" value={fileChangesDisplay} icon={FileCode} />
        <MetadataItem label="Branch" value={task.branch || '-'} icon={GitBranch} />
      </div>
    </div>
  );
}
