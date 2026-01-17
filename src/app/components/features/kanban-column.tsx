import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/app/components/ui/skeleton';
import { KanbanCard } from './kanban-card';

interface KanbanColumnProps {
  id: TaskColumn;
  title: string;
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  isLoading?: boolean;
}

const COLUMN_ACCENTS: Record<TaskColumn, string> = {
  backlog: 'border-t-foreground/20',
  in_progress: 'border-t-accent',
  waiting_approval: 'border-t-attention',
  verified: 'border-t-success',
};

export function KanbanColumn({
  id,
  title,
  tasks,
  onTaskClick,
  isLoading,
}: KanbanColumnProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-80 flex-shrink-0 flex-col rounded-lg border border-border bg-surface',
        COLUMN_ACCENTS[id],
        isOver && 'ring-2 ring-accent-muted'
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">{title}</h3>
        <span className="rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-fg-muted">
          {tasks.length}
        </span>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-24 w-full" />
            ))}
          </div>
        ) : (
          <SortableContext
            items={tasks.map((task) => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {tasks.map((task) => (
                <KanbanCard key={task.id} task={task} onClick={() => onTaskClick(task)} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </div>
  );
}
