import { Plus } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApprovalDialog } from '@/app/components/features/approval-dialog';
import { KanbanBoard } from '@/app/components/features/kanban-board';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Task, TaskColumn } from '@/db/schema/tasks';

export const Route = createFileRoute('/projects/$projectId/')({
  loader: async () => ({ project: null, tasks: [], agents: [] }),
  component: ProjectKanban,
});

function ProjectKanban(): React.JSX.Element {
  const loaderData = Route.useLoaderData();
  const { projectService, taskService } = useServices();
  const [project, setProject] = useState(loaderData.project as { id: string; name: string } | null);
  const [tasks, setTasks] = useState<Task[]>(loaderData.tasks ?? []);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<Task | null>(null);

  const { projectId } = Route.useParams();

  useEffect(() => {
    const load = async () => {
      const projectResult = await projectService.getById(projectId);
      const tasksResult = await taskService.list(projectId);

      if (projectResult.ok) {
        setProject(projectResult.value);
      }

      if (tasksResult.ok) {
        setTasks(tasksResult.value);
      }
    };

    void load();
  }, [projectId, projectService, taskService]);

  const handleTaskMove = async (taskId: string, column: TaskColumn, position: number) => {
    await taskService.moveColumn(taskId, column, position);
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
      createMergeCommit: commitMessage ? true : undefined,
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
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Project</p>
          <h1 className="text-lg font-semibold text-fg">{project.name}</h1>
        </div>
        <Button onClick={() => setShowNewTask(true)}>
          <Plus className="h-4 w-4" />
          New Task
        </Button>
      </header>

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
            await taskService.update(selectedTask.id, data);
          } else {
            await taskService.create({
              projectId: project.id,
              ...data,
            } as never);
          }
        }}
        onDelete={async (id) => {
          await taskService.delete(id);
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
    </div>
  );
}
