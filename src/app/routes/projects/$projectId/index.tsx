import { Plus } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApprovalDialog } from '@/app/components/features/approval-dialog';
import { KanbanBoard } from '@/app/components/features/kanban-board';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Project } from '@/db/schema/projects';
import type { Task, TaskColumn } from '@/db/schema/tasks';

export const Route = createFileRoute('/projects/$projectId/')({
  loader: async ({ context, params }) => {
    if (!context.services) {
      return { project: null, tasks: [] };
    }

    const [projectResult, tasksResult] = await Promise.all([
      context.services.projectService.getById(params.projectId),
      context.services.taskService.list(params.projectId),
    ]);

    return {
      project: projectResult.ok ? projectResult.value : null,
      tasks: tasksResult.ok ? tasksResult.value : [],
    };
  },
  component: ProjectKanban,
});

function ProjectKanban(): React.JSX.Element {
  const { projectService, taskService } = useServices();
  const { projectId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const [project, setProject] = useState<Project | null>(loaderData.project ?? null);
  const [tasks, setTasks] = useState<Task[]>(loaderData.tasks ?? []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!project) {
      const refresh = async () => {
        const projectResult = await projectService.getById(projectId);
        if (projectResult.ok) {
          setProject(projectResult.value);
        }
      };
      void refresh();
    }
  }, [project, projectId, projectService]);

  const handleTaskMove = async (taskId: string, column: TaskColumn, position: number) => {
    const result = await taskService.moveColumn(taskId, column, position);
    if (result.ok) {
      setTasks((prev) => prev.map((task) => (task.id === taskId ? result.value : task)));
    }
  };

  const handleTaskClick = (task: Task) => {
    if (task.column === 'waiting_approval') {
      setApprovalTask(task);
    } else {
      setSelectedTask(task);
    }
  };

  const handleApprove = async (commitMessage?: string) => {
    if (!approvalTask) return;
    await taskService.approve(approvalTask.id, {
      approvedBy: 'current-user',
      createMergeCommit: Boolean(commitMessage),
    });
  };

  const handleReject = async (reason: string) => {
    if (!approvalTask) return;
    await taskService.reject(approvalTask.id, { reason });
  };

  if (!project) {
    return <div className="p-6 text-sm text-fg-muted">Project not found.</div>;
  }

  return (
    <LayoutShell
      projectId={project.id}
      projectName={project.name}
      projectPath={project.path}
      breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: project.name }]}
      actions={
        <Button onClick={() => setShowNewTask(true)} data-testid="add-task-button">
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      }
    >
      <main className="flex-1 overflow-hidden bg-canvas">
        <KanbanBoard tasks={tasks} onTaskMove={handleTaskMove} onTaskClick={handleTaskClick} />
      </main>

      <TaskDetailDialog
        task={selectedTask}
        open={Boolean(selectedTask) || showNewTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            setShowNewTask(false);
          }
        }}
        onSave={async (data) => {
          if (selectedTask) {
            const result = await taskService.update(selectedTask.id, data);
            if (result.ok) {
              setTasks((prev) =>
                prev.map((task) => (task.id === result.value.id ? result.value : task))
              );
            }
          } else if (project) {
            const result = await taskService.create({
              projectId: project.id,
              ...data,
            } as never);
            if (result.ok) {
              setTasks((prev) => [result.value, ...prev]);
            }
          }
        }}
        onDelete={async (id) => {
          const result = await taskService.delete(id);
          if (result.ok) {
            setTasks((prev) => prev.filter((task) => task.id !== id));
          }
        }}
      />

      {approvalTask && (
        <ApprovalDialog
          task={approvalTask}
          diff={approvalTask.diffSummary ?? null}
          open={Boolean(approvalTask)}
          onOpenChange={(open) => {
            if (!open) {
              setApprovalTask(null);
            }
          }}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}
    </LayoutShell>
  );
}
