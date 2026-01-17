import type { Task, TaskColumn } from '@/db/schema/tasks';

interface KanbanBoardProps {
  tasks: Task[];
  onTaskMove: (taskId: string, column: TaskColumn, position: number) => Promise<void>;
  onTaskClick: (task: Task) => void;
}

const COLUMNS: { id: TaskColumn; label: string }[] = [
  { id: 'backlog', label: 'Backlog' },
  { id: 'in_progress', label: 'In Progress' },
  { id: 'waiting_approval', label: 'Waiting Approval' },
  { id: 'verified', label: 'Verified' },
];

export function KanbanBoard({
  tasks,
  onTaskMove,
  onTaskClick,
}: KanbanBoardProps): React.JSX.Element {
  const tasksByColumn = COLUMNS.reduce(
    (acc, col) => {
      acc[col.id] = tasks.filter((t) => t.column === col.id);
      return acc;
    },
    {} as Record<TaskColumn, Task[]>
  );

  return (
    <div className="flex h-full gap-4 overflow-x-auto p-4">
      {COLUMNS.map((col) => (
        <div
          key={col.id}
          className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-surface"
        >
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-sm font-medium text-fg">{col.label}</h3>
            <p className="text-xs text-fg-muted">{tasksByColumn[col.id].length} tasks</p>
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto p-2">
            {tasksByColumn[col.id].map((task) => (
              <button
                key={task.id}
                type="button"
                className="w-full rounded border border-border bg-canvas p-3 text-left hover:border-accent"
                onClick={() => onTaskClick(task)}
                onDragEnd={() => {
                  void onTaskMove(task.id, col.id, 0);
                }}
              >
                <p className="text-sm font-medium text-fg">{task.title}</p>
                {task.description && (
                  <p className="mt-1 text-xs text-fg-muted line-clamp-2">
                    {task.description}
                  </p>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
