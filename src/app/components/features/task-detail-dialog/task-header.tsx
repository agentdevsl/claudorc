import { Circle, Copy, X } from '@phosphor-icons/react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cva } from 'class-variance-authority';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import type { TaskViewer } from './index';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
  {
    variants: {
      column: {
        backlog: 'bg-surface-muted text-fg-muted',
        queued: 'bg-purple-500/20 text-purple-400',
        in_progress: 'bg-accent-muted text-accent',
        waiting_approval: 'bg-attention-muted text-attention',
        verified: 'bg-success-muted text-success',
      },
    },
    defaultVariants: {
      column: 'backlog',
    },
  }
);

const priorityVariants = cva(
  'inline-flex h-7 items-center justify-center gap-1 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer border',
  {
    variants: {
      priority: {
        high: 'border-danger/30 text-danger hover:bg-danger-muted',
        medium: 'border-attention/30 text-attention hover:bg-attention-muted',
        low: 'border-success/30 text-success hover:bg-success-muted',
      },
      selected: {
        true: '',
        false: 'opacity-50',
      },
    },
    compoundVariants: [
      {
        priority: 'high',
        selected: true,
        className: 'bg-danger-muted',
      },
      {
        priority: 'medium',
        selected: true,
        className: 'bg-attention-muted',
      },
      {
        priority: 'low',
        selected: true,
        className: 'bg-success-muted',
      },
    ],
    defaultVariants: {
      priority: 'medium',
      selected: false,
    },
  }
);

function getColumnLabel(column: TaskColumn): string {
  switch (column) {
    case 'backlog':
      return 'Backlog';
    case 'queued':
      return 'Queued';
    case 'in_progress':
      return 'In Progress';
    case 'waiting_approval':
      return 'Waiting Approval';
    case 'verified':
      return 'Verified';
    default:
      return column;
  }
}

function formatTaskId(id: string): string {
  // Use last 3 chars of the ID for display
  const shortId = id.slice(-3).toUpperCase();
  return `#TSK-${shortId}`;
}

interface TaskHeaderProps {
  task: Task;
  viewers: TaskViewer[];
  onPriorityChange: (priority: 'high' | 'medium' | 'low') => void;
}

export function TaskHeader({
  task,
  viewers,
  onPriorityChange,
}: TaskHeaderProps): React.JSX.Element {
  // Extract priority from task metadata or use default
  const currentPriority =
    (task as Task & { priority?: 'high' | 'medium' | 'low' }).priority ?? 'medium';

  const handleCopyId = () => {
    navigator.clipboard.writeText(task.id);
  };

  return (
    <div className="flex flex-col gap-3 border-b border-border p-5">
      {/* Top row: status badge, task ID, viewers, close button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span className={statusBadgeVariants({ column: task.column })}>
            <Circle weight="fill" className="h-2 w-2" />
            {getColumnLabel(task.column)}
          </span>

          {/* Task ID with copy */}
          <button
            type="button"
            onClick={handleCopyId}
            className="group flex items-center gap-1 font-mono text-xs text-fg-muted hover:text-fg transition-colors"
            title="Copy task ID"
          >
            {formatTaskId(task.id)}
            <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Viewers avatar stack */}
          {viewers.length > 0 && (
            <div className="flex items-center -space-x-2">
              {viewers.slice(0, 3).map((viewer) => (
                <div
                  key={viewer.userId}
                  className="relative h-6 w-6 rounded-full border-2 border-surface bg-accent-muted flex items-center justify-center"
                  title={viewer.displayName}
                >
                  {viewer.avatarUrl ? (
                    <img
                      src={viewer.avatarUrl}
                      alt={viewer.displayName}
                      className="h-full w-full rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] font-medium text-accent">
                      {viewer.displayName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
              ))}
              {viewers.length > 3 && (
                <div className="relative h-6 w-6 rounded-full border-2 border-surface bg-surface-muted flex items-center justify-center">
                  <span className="text-[10px] font-medium text-fg-muted">
                    +{viewers.length - 3}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Close button */}
          <DialogPrimitive.Close className="rounded-sm p-1 text-fg-muted transition hover:bg-surface-muted hover:text-fg focus:outline-none">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </div>
      </div>

      {/* Title */}
      <h2 className="text-lg font-semibold text-fg">{task.title}</h2>

      {/* Priority selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-fg-muted">Priority</span>
        <div className="flex items-center gap-1">
          {(['high', 'medium', 'low'] as const).map((priority) => (
            <button
              key={priority}
              type="button"
              onClick={() => onPriorityChange(priority)}
              className={priorityVariants({
                priority,
                selected: currentPriority === priority,
              })}
            >
              {priority.charAt(0).toUpperCase() + priority.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
