import { createFileRoute } from '@tanstack/react-router';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import type { RouterContext } from '@/app/router';
import { useServices } from '@/app/services/service-context';
import type { Project } from '@/db/schema/projects';
import type { Task } from '@/db/schema/tasks';

export interface LoaderData {
  task: Task | null;
  project: Project | null;
}

export const Route = createFileRoute('/projects/$projectId/tasks/$taskId')({
  loader: async ({
    context,
    params,
  }: {
    context: RouterContext;
    params: { projectId: string; taskId: string };
  }): Promise<LoaderData> => {
    if (!context.services) {
      return { task: null, project: null };
    }

    const [taskResult, projectResult] = await Promise.all([
      context.services.taskService.getById(params.taskId),
      context.services.projectService.getById(params.projectId),
    ]);

    if (!taskResult.ok || taskResult.value.projectId !== params.projectId) {
      return { task: null, project: projectResult.ok ? projectResult.value : null };
    }

    return {
      task: taskResult.value,
      project: projectResult.ok ? projectResult.value : null,
    };
  },
  component: TaskDetailRoute,
});

function TaskDetailRoute(): React.JSX.Element {
  const { task, project } = Route.useLoaderData() as LoaderData;
  const { taskService } = useServices();

  if (!task) {
    return <div className="p-6 text-sm text-fg-muted">Task not found.</div>;
  }

  return (
    <LayoutShell
      projectId={project?.id}
      projectName={project?.name}
      projectPath={project?.path}
      breadcrumbs={[
        { label: 'Projects', to: '/projects' },
        { label: project?.name ?? 'Project', to: `/projects/${project?.id}` },
        { label: task.title },
      ]}
    >
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
