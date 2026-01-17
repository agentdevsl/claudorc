import type { Task } from '@/db/schema/tasks';

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { title?: string; description?: string }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onSave,
  onDelete,
}: TaskDetailDialogProps): React.JSX.Element | null {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg rounded-lg bg-surface p-6">
        <h2 className="text-lg font-semibold text-fg">
          {task ? 'Edit Task' : 'New Task'}
        </h2>
        {task && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-fg">Title</label>
              <p className="text-sm text-fg-muted">{task.title}</p>
            </div>
            {task.description && (
              <div>
                <label className="text-sm font-medium text-fg">Description</label>
                <p className="text-sm text-fg-muted">{task.description}</p>
              </div>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-between">
          {task && (
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm text-red-500 hover:bg-red-500/10"
              onClick={() => {
                void onDelete(task.id);
                onOpenChange(false);
              }}
            >
              Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              className="rounded px-3 py-1.5 text-sm text-fg-muted hover:bg-surface-hover"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded bg-accent px-3 py-1.5 text-sm text-accent-fg hover:bg-accent-hover"
              onClick={() => {
                void onSave({});
                onOpenChange(false);
              }}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
