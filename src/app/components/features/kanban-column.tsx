import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CaretDown, CaretRight, Plus } from '@phosphor-icons/react';
import { Skeleton } from '@/app/components/ui/skeleton';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';
import type { ColumnConfig, Priority } from './kanban-board/constants';
import { KanbanCard } from './kanban-card';

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
  config,
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });

  // Default accent classes if no config provided
  const accentClass = config?.accentClass ?? 'border-t-[var(--fg-muted)]';
  const indicatorColor = config?.indicatorColor ?? 'bg-[var(--fg-muted)]';

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        className={cn(
          'flex w-12 flex-shrink-0 flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)]',
          accentClass,
          'border-t-2',
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
        'flex w-full flex-col rounded-lg border border-[var(--border-default)] bg-[var(--bg-default)] md:w-[300px] md:flex-shrink-0',
        accentClass,
        'border-t-2',
        isOver && 'bg-[var(--accent-muted)] ring-2 ring-[var(--accent-fg)]'
      )}
      data-testid={`column-${id}`}
      data-column={id}
    >
      {/* Column header */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border-default)] px-3 py-3"
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
          <div className="flex items-center gap-2">
            <div className={cn('h-3.5 w-[3px] rounded-sm', indicatorColor)} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-[var(--fg-default)]">{title}</h3>
            <span
              className="rounded-full bg-[var(--bg-muted)] px-2 py-0.5 text-xs font-medium text-[var(--fg-muted)]"
              data-testid="task-count"
            >
              {tasks.length}
            </span>
          </div>
        </div>
        {onAddTask && (
          <button
            type="button"
            onClick={onAddTask}
            className="flex h-6 w-6 items-center justify-center rounded text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--fg-default)]"
            aria-label={`Add task to ${title}`}
            data-testid="add-task-button"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
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
