import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Circle, DotsSixVertical, Spinner } from '@phosphor-icons/react';
import { cva } from 'class-variance-authority';
import type { Task } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';
import {
  formatTaskId,
  getLabelColors,
  PRIORITY_CONFIG,
  type Priority,
} from './kanban-board/constants';

const cardVariants = cva(
  'group relative cursor-pointer rounded-md border bg-[var(--bg-subtle)] p-3 text-left transition-all duration-150 ease-out',
  {
    variants: {
      isDragging: {
        true: 'opacity-50',
        false: 'hover:border-[var(--fg-subtle)]',
      },
      isSelected: {
        true: 'border-[var(--accent-fg)] bg-[var(--accent-muted)]',
        false: 'border-[var(--border-default)]',
      },
      hasAgent: {
        true: '',
        false: '',
      },
    },
    defaultVariants: {
      isDragging: false,
      isSelected: false,
      hasAgent: false,
    },
  }
);

interface KanbanCardProps {
  task: Task;
  onClick?: () => void;
  onSelect?: (taskId: string, isMultiSelect: boolean) => void;
  isDragging?: boolean;
  isSelected?: boolean;
  priority?: Priority;
}

export function KanbanCard({
  task,
  onClick,
  onSelect,
  isDragging: isDraggingProp,
  isSelected = false,
  priority,
}: KanbanCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // Multi-select mode
      e.preventDefault();
      e.stopPropagation();
      onSelect?.(task.id, true);
    } else {
      onClick?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        onSelect?.(task.id, true);
      } else {
        onClick?.();
      }
    }
  };

  const priorityConfig = priority ? PRIORITY_CONFIG[priority] : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit provides role via attributes spread
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        cardVariants({
          isDragging: isDraggingProp ?? isDragging,
          isSelected,
          hasAgent: Boolean(task.agentId),
        }),
        'touch-none' // Prevent scroll interference during drag
      )}
      {...attributes}
      {...listeners}
      data-testid="task-card"
      data-selected={isSelected ? 'true' : undefined}
      data-queued={task.column === 'in_progress' && !task.agentId ? 'true' : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {/* Labels row */}
      {task.labels && task.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5" data-testid="task-labels">
          {task.labels.map((label) => {
            const colors = getLabelColors(label);
            return (
              <span
                key={label}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide',
                  colors.bg,
                  colors.text
                )}
                data-testid="task-label"
              >
                {label}
              </span>
            );
          })}
        </div>
      )}

      {/* Header with priority and title */}
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 flex-shrink-0 cursor-grab text-[var(--fg-subtle)] opacity-0 transition-opacity duration-150 ease-out group-hover:opacity-100"
          data-testid="drag-handle"
          aria-label="Drag to reorder"
          {...listeners}
        >
          <DotsSixVertical className="h-4 w-4" />
        </button>

        {priorityConfig && (
          <div
            className={cn('mt-1.5 h-2 w-2 flex-shrink-0 rounded-full', priorityConfig.color)}
            title={`${priorityConfig.label} priority`}
            data-testid="priority-indicator"
          />
        )}

        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-medium leading-snug text-[var(--fg-default)]"
            data-testid="task-card-title"
          >
            {task.title}
          </p>
        </div>
      </div>

      {/* Footer with ID and agent status */}
      <div className="mt-2.5 flex items-center justify-between">
        <span className="font-mono text-xs text-[var(--fg-muted)]" data-testid="task-id">
          {formatTaskId(task.id)}
        </span>

        {task.agentId && (
          <div
            className="flex items-center gap-1.5 rounded bg-[var(--attention-muted)] px-2 py-1 text-xs text-[var(--attention-fg)]"
            data-testid="agent-status-indicator"
          >
            <Circle weight="fill" className="h-1.5 w-1.5 animate-pulse" />
            <span>Agent running</span>
          </div>
        )}
      </div>

      {/* Agent status bar (when running) */}
      {task.agentId && task.column === 'in_progress' && (
        <div
          className="mt-2 flex items-center gap-2 rounded bg-[var(--attention-muted)] px-2 py-1.5 text-xs text-[var(--attention-fg)]"
          data-testid="agent-running-status"
        >
          <Spinner className="h-3 w-3 animate-spin" />
          <span className="truncate">Processing...</span>
        </div>
      )}
    </div>
  );
}
