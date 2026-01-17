import { createFileRoute } from '@tanstack/react-router';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { useServices } from '@/app/services/service-context';
import type { Task } from '@/db/schema/tasks';

export const Route = createFileRoute('/projects/$projectId/tasks/$taskId')({
  loader: async ({ context, params }): Promise<{ task: Task | null }> => {
    if (!context.services) {
      return { task: null };
    }

    const taskResult = await context.services.taskService.getById(params.taskId);
    if (!taskResult.ok || taskResult.value.projectId !== params.projectId) {
      return { task: null };
    }

    return { task: taskResult.value };
  },
  component: TaskDetailRoute,
});

function TaskDetailRoute(): React.JSX.Element {
  const loaderData = Route.useLoaderData() as { task: Task | null };
  const { taskService } = useServices();
  const task = loaderData.task;

  if (!task) {
    return <div className="p-6 text-sm text-fg-muted">Task not found.</div>;
  }

  return (
    <LayoutShell breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: task.title }]}>
      <TaskDetailDialog
        task={task}
        open
        onOpenChange={() => {}}
        onSave={async (data) => {
          await taskService.update(task.id, data);
        }}
        onDelete={async (id) => {
          await taskService.delete(id);
        }}
      />
    </LayoutShell>
  );
}
