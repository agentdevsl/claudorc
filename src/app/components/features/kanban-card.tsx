import { DotsSixVertical, UserCircle } from '@phosphor-icons/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cva } from 'class-variance-authority';
import type { Task } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';

const cardVariants = cva(
  'group relative rounded-md border border-border bg-surface p-3 text-left transition duration-fast ease-out hover:border-fg-subtle',
  {
    variants: {
      isDragging: {
        true: 'opacity-60',
        false: '',
      },
      hasAgent: {
        true: 'border-l-2 border-l-accent',
        false: '',
      },
    },
    defaultVariants: {
      isDragging: false,
      hasAgent: false,
    },
  }
);

interface KanbanCardProps {
  task: Task;
  onClick?: () => void;
  isDragging?: boolean;
}

export function KanbanCard({
  task,
  onClick,
  isDragging: isDraggingProp,
}: KanbanCardProps): React.JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: dnd-kit provides role via attributes spread
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        cardVariants({
          isDragging: isDraggingProp ?? isDragging,
          hasAgent: Boolean(task.agentId),
        })
      )}
      {...attributes}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-1 cursor-grab text-fg-subtle opacity-0 transition duration-fast ease-out group-hover:opacity-100"
          {...listeners}
        >
          <DotsSixVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-semibold text-fg">{task.title}</p>
          {task.description && (
            <p className="text-xs text-fg-muted line-clamp-2">{task.description}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {task.labels?.map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-border px-2 py-0.5 text-[11px] text-fg-muted"
                >
                  {label}
                </span>
              ))}
            </div>
            {task.agentId && (
              <span className="flex items-center gap-1 text-[11px] text-fg-muted">
                <UserCircle className="h-3 w-3" />
                Agent
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
