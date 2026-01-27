import { GearSix } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useCallback, useEffect, useState } from 'react';
import { ApprovalDialog } from '@/app/components/features/approval-dialog';
import { KanbanBoard } from '@/app/components/features/kanban-board';
import { LayoutShell } from '@/app/components/features/layout-shell';
// Use separate dialogs: new-task-dialog for creation, task-detail-dialog for editing with mode toggle
import { NewTaskDialog } from '@/app/components/features/new-task-dialog';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog/index';
import { AIActionButton } from '@/app/components/ui/ai-action-button';
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
  const [error, setError] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<ClientTask | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<ClientTask | null>(null);

  // Fetch project and tasks from API
  const fetchData = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      const [projectResult, tasksResult] = await Promise.all([
        apiClient.projects.get(projectId),
        apiClient.tasks.list(projectId),
      ]);

      if (!projectResult.ok) {
        console.error('[ProjectKanban] Failed to fetch project:', projectResult.error);
        setError(`Failed to load project: ${projectResult.error.message}`);
        setIsLoading(false);
        return;
      }

      setProject(projectResult.data);

      if (!tasksResult.ok) {
        console.error('[ProjectKanban] Failed to fetch tasks:', tasksResult.error);
        setError(`Failed to load tasks: ${tasksResult.error.message}`);
      } else {
        setTasks(tasksResult.data.items as ClientTask[]);
      }
    } catch (err) {
      console.error('[ProjectKanban] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  // Fetch on mount and when projectId changes
  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  if (error) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Projects', to: '/projects' }, { label: 'Error' }]}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="text-destructive text-sm">{error}</div>
          <button
            type="button"
            onClick={() => fetchData()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
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
      centerAction={
        <AIActionButton onClick={() => setShowNewTask(true)} data-testid="add-task-button" />
      }
      actions={
        <Link
          to="/projects/$projectId/settings"
          params={{ projectId: project.id }}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-subtle text-fg-muted transition-colors hover:bg-surface hover:text-fg"
          data-testid="project-settings-link"
        >
          <GearSix className="h-4 w-4" />
          <span className="sr-only">Project settings</span>
        </Link>
      }
    >
      <KanbanBoard
        tasks={tasks as Parameters<typeof KanbanBoard>[0]['tasks']}
        onTaskMove={handleTaskMove as Parameters<typeof KanbanBoard>[0]['onTaskMove']}
        onTaskClick={handleTaskClick as Parameters<typeof KanbanBoard>[0]['onTaskClick']}
      />

      {/* New Task Dialog - AI-powered task creation with streaming */}
      <NewTaskDialog
        projectId={projectId}
        open={showNewTask}
        onOpenChange={(open) => {
          if (!open) setShowNewTask(false);
        }}
        onTaskCreated={async (_taskId) => {
          // Refresh tasks list after AI creates a new task
          const tasksResult = await apiClient.tasks.list(projectId);
          if (tasksResult.ok) {
            setTasks(tasksResult.data.items as ClientTask[]);
          }
        }}
      />

      {/* Edit Task Dialog - uses new dialog with mode toggle */}
      <TaskDetailDialog
        task={selectedTask as Parameters<typeof TaskDetailDialog>[0]['task']}
        open={Boolean(selectedTask)}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null);
        }}
        onSave={async (data) => {
          if (selectedTask) {
            setTasks((prev) =>
              prev.map((task) => (task.id === selectedTask.id ? { ...task, ...data } : task))
            );
          }
        }}
        onDelete={async (id) => {
          const result = await apiClient.tasks.delete(id);
          if (result.ok) {
            setTasks((prev) => prev.filter((task) => task.id !== id));
          } else {
            console.error('[ProjectKanban] Failed to delete task:', result.error);
          }
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
