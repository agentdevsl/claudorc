import { createFileRoute } from '@tanstack/react-router';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { db } from '@/db/client';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const taskService = new TaskService(db, worktreeService);

export const Route = createFileRoute('/projects/$projectId/tasks/$taskId')({
  loader: async ({ params }) => {
    const taskResult = await taskService.getById(params.taskId);
    if (!taskResult.ok) {
      throw new Error('Task not found');
    }

    if (taskResult.value.projectId !== params.projectId) {
      throw new Error('Task does not belong to project');
    }

    return { task: taskResult.value };
  },
  component: TaskDetailRoute,
});

function TaskDetailRoute(): React.JSX.Element {
  const { task } = Route.useLoaderData();

  return (
    <TaskDetailDialog
      task={task}
      open
      onOpenChange={() => {}}
      onSave={async () => {}}
      onDelete={async () => {}}
    />
  );
}
