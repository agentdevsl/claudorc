import { GearSix, Plus } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApprovalDialog } from '@/app/components/features/approval-dialog';
import { KanbanBoard } from '@/app/components/features/kanban-board';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { Button } from '@/app/components/ui/button';
import type { Task } from '@/db/schema/tasks';
import { apiClient, type ProjectListItem } from '@/lib/api/client';
import type { DiffSummary } from '@/lib/types/diff';

// Client task type - subset of Task for client-side display
type ClientTask = Pick<
  Task,
  'id' | 'projectId' | 'title' | 'description' | 'column' | 'position' | 'labels' | 'agentId'
> & {
  priority?: 'low' | 'medium' | 'high';
  diffSummary?: DiffSummary | null;
};

export const Route = createFileRoute('/projects/$projectId/')({
  component: ProjectKanban,
});

function ProjectKanban(): React.JSX.Element {
  const { projectId } = Route.useParams();
  const [project, setProject] = useState<ProjectListItem | null>(null);
  const [tasks, setTasks] = useState<ClientTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<ClientTask | null>(null);

  // Fetch project and tasks from API on mount
  useEffect(() => {
    const fetchData = async () => {
      const [projectResult, tasksResult] = await Promise.all([
        apiClient.projects.get(projectId),
        apiClient.tasks.list(projectId),
      ]);

      if (projectResult.ok) {
        setProject(projectResult.data);
      }
      if (tasksResult.ok) {
        setTasks(tasksResult.data.items as ClientTask[]);
      }
      setIsLoading(false);
    };
    fetchData();
  }, [projectId]);

  const handleTaskMove = async (
    taskId: string,
    column: ClientTask['column'],
    _position: number
  ) => {
    // Optimistic update
    setTasks((prev) => prev.map((task) => (task.id === taskId ? { ...task, column } : task)));
    // TODO: Add API endpoint for moving tasks
  };

  const handleTaskClick = (task: ClientTask) => {
    if (task.column === 'waiting_approval') {
      setApprovalTask(task);
    } else {
      setSelectedTask(task);
    }
  };

  const handleApprove = async (_commitMessage?: string) => {
    if (!approvalTask) return;
    // TODO: Add API endpoint for approving tasks
    setApprovalTask(null);
  };

  const handleReject = async (_reason: string) => {
    if (!approvalTask) return;
    // TODO: Add API endpoint for rejecting tasks
    setApprovalTask(null);
  };

  if (isLoading) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Loading...' }]}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Loading project...</div>
        </div>
      </LayoutShell>
    );
  }

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
        <div className="flex items-center gap-2">
          <Link
            to="/projects/$projectId/settings"
            params={{ projectId: project.id }}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-subtle text-fg-muted transition-colors hover:bg-surface hover:text-fg"
            data-testid="project-settings-link"
          >
            <GearSix className="h-4 w-4" />
            <span className="sr-only">Project settings</span>
          </Link>
          <Button onClick={() => setShowNewTask(true)} data-testid="add-task-button">
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      }
    >
      <main className="flex-1 overflow-hidden bg-canvas">
        <KanbanBoard
          tasks={tasks as Parameters<typeof KanbanBoard>[0]['tasks']}
          onTaskMove={handleTaskMove as Parameters<typeof KanbanBoard>[0]['onTaskMove']}
          onTaskClick={handleTaskClick as Parameters<typeof KanbanBoard>[0]['onTaskClick']}
        />
      </main>

      <TaskDetailDialog
        task={selectedTask as Parameters<typeof TaskDetailDialog>[0]['task']}
        open={Boolean(selectedTask) || showNewTask}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedTask(null);
            setShowNewTask(false);
          }
        }}
        onSave={async (data) => {
          if (selectedTask) {
            // TODO: Add API endpoint for updating tasks
            setTasks((prev) =>
              prev.map((task) => (task.id === selectedTask.id ? { ...task, ...data } : task))
            );
          } else if (project) {
            // TODO: Add API endpoint for creating tasks
            const newTask: ClientTask = {
              id: `temp-${Date.now()}`,
              projectId: project.id,
              title: data.title ?? 'New Task',
              description: data.description ?? null,
              column: 'backlog',
              priority: data.priority ?? 'medium',
              position: 0,
              labels: data.labels ?? [],
              agentId: null,
            };
            setTasks((prev) => [newTask, ...prev]);
          }
        }}
        onDelete={async (id) => {
          // TODO: Add API endpoint for deleting tasks
          setTasks((prev) => prev.filter((task) => task.id !== id));
        }}
      />

      {approvalTask && (
        <ApprovalDialog
          task={approvalTask as Parameters<typeof ApprovalDialog>[0]['task']}
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
