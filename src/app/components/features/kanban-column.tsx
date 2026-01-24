import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Icon } from '@phosphor-icons/react';
import {
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Lightning,
  Plus,
  Stack,
  User,
} from '@phosphor-icons/react';
import { Skeleton } from '@/app/components/ui/skeleton';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';
import type { ColumnConfig, Priority } from './kanban-board/constants';
import { KanbanCard } from './kanban-card';

/**
 * Semantic icons for each Kanban column
 */
const COLUMN_ICONS: Record<TaskColumn, Icon> = {
  backlog: Stack,
  queued: Clock,
  in_progress: Lightning,
  waiting_approval: User,
  verified: CheckCircle,
};

/**
 * Icon badge background colors (12% opacity)
 */
const ICON_BADGE_STYLES: Record<TaskColumn, string> = {
  backlog: 'bg-[rgba(139,148,158,0.12)] text-[#8b949e]',
  queued: 'bg-[rgba(88,166,255,0.12)] text-[#58a6ff]',
  in_progress: 'bg-[rgba(210,153,34,0.12)] text-[#d29922]',
  waiting_approval: 'bg-[rgba(163,113,247,0.12)] text-[#a371f7]',
  verified: 'bg-[rgba(63,185,80,0.12)] text-[#3fb950]',
};

/**
 * Subtle diagonal gradients for column headers (8% opacity)
 */
const HEADER_GRADIENT_STYLES: Record<TaskColumn, React.CSSProperties> = {
  backlog: { background: 'linear-gradient(135deg, rgba(139,148,158,0.08) 0%, transparent 60%)' },
  queued: { background: 'linear-gradient(135deg, rgba(88,166,255,0.08) 0%, transparent 60%)' },
  in_progress: { background: 'linear-gradient(135deg, rgba(210,153,34,0.08) 0%, transparent 60%)' },
  waiting_approval: {
    background: 'linear-gradient(135deg, rgba(163,113,247,0.08) 0%, transparent 60%)',
  },
  verified: { background: 'linear-gradient(135deg, rgba(63,185,80,0.08) 0%, transparent 60%)' },
};

interface KanbanColumnProps {
  id: TaskColumn;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskSelect?: (taskId: string, isMultiSelect: boolean) => void;
  isTaskSelected?: (taskId: string) => boolean;
  isLoading?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onAddTask?: () => void;
  /** Custom header action to replace the default add button */
  headerAction?: React.ReactNode;
  config?: ColumnConfig;
}

export function KanbanColumn({
  id,
  title,
  tasks,
  onTaskClick,
  onTaskSelect,
  isTaskSelected,
  isLoading,
  isCollapsed = false,
  onToggleCollapse,
  onAddTask,
  headerAction,
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex w-12 flex-shrink-0 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)]',
          isOver && 'ring-2 ring-[var(--accent-muted)]'
        )}
        data-testid={`column-${id}`}
        data-column={id}
        data-collapsed="true"
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex h-full flex-col items-center gap-3 px-2 py-4 text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-default)]"
          aria-label={`Expand ${title} column`}
        >
          <CaretRight className="h-4 w-4" />
          <span className="text-xs font-semibold [writing-mode:vertical-rl]">{title}</span>
          <span className="rounded-full bg-[var(--bg-muted)] px-1.5 py-0.5 text-xs font-medium text-[var(--fg-muted)]">
            {tasks.length}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-w-[200px] flex-1 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)]',
        isOver && 'bg-[var(--accent-muted)] ring-2 ring-[var(--accent-fg)]'
      )}
      data-testid={`column-${id}`}
      data-column={id}
    >
      {/* Column header */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-default)] px-3 py-3"
        style={HEADER_GRADIENT_STYLES[id]}
        data-testid="column-header"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--fg-default)]"
            aria-label={`Collapse ${title} column`}
          >
            <CaretDown className="h-3.5 w-3.5" />
          </button>
          <div className="flex items-center gap-2.5">
            {/* Icon badge - 24x24px with 6px radius */}
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-[6px]',
                ICON_BADGE_STYLES[id]
              )}
              aria-hidden="true"
            >
              {(() => {
                const IconComponent = COLUMN_ICONS[id];
                return <IconComponent className="h-3.5 w-3.5" weight="bold" />;
              })()}
            </div>
            <h3 className="text-sm font-semibold text-[var(--fg-default)]">{title}</h3>
            <span
              className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)]"
              data-testid="task-count"
            >
              {tasks.length}
            </span>
          </div>
        </div>
        {headerAction ??
          (onAddTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="flex h-6 w-6 items-center justify-center rounded text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--fg-default)]"
              aria-label={`Add task to ${title}`}
              data-testid="add-task-button"
            >
              <Plus className="h-4 w-4" />
            </button>
          ))}
      </div>

      {/* Column content */}
      <div className="flex-1 space-y-2.5 overflow-y-auto p-3" data-testid="task-list">
        {isLoading ? (
          <div className="space-y-2.5">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full rounded-md" data-testid="task-skeleton" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[var(--border-default)] bg-[var(--bg-subtle)] px-3 py-6 text-center text-xs text-[var(--fg-muted)]"
            data-testid="empty-column"
          >
            <span className="text-[var(--fg-subtle)]" data-testid="empty-column-state">
              No tasks yet
            </span>
            {onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-default)] px-2.5 py-1 text-[11px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg-default)]"
                data-testid="add-task-button"
              >
                Add task
              </button>
            )}
          </div>
        ) : (
          <SortableContext
            items={tasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2.5">
              {tasks.map((task) => (
                <KanbanCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                  onSelect={onTaskSelect}
                  isSelected={isTaskSelected?.(task.id) ?? false}
                  priority={getPriorityFromLabels(task.labels)}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}

/**
 * Extract priority from task labels
 * Looks for labels like "high", "medium", "low" or "p0", "p1", "p2"
 */
function getPriorityFromLabels(labels?: string[] | null): Priority | undefined {
  if (!labels || labels.length === 0) return undefined;

  const lowercaseLabels = labels.map((l) => l.toLowerCase());

  if (
    lowercaseLabels.includes('high') ||
    lowercaseLabels.includes('p0') ||
    lowercaseLabels.includes('critical')
  ) {
    return 'high';
  }
  if (lowercaseLabels.includes('medium') || lowercaseLabels.includes('p1')) {
    return 'medium';
  }
  if (
    lowercaseLabels.includes('low') ||
    lowercaseLabels.includes('p2') ||
    lowercaseLabels.includes('minor')
  ) {
    return 'low';
  }

  return undefined;
}
