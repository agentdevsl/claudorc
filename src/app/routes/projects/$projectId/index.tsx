import { Plus } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { ApprovalDialog } from '@/app/components/features/approval-dialog';
import { KanbanBoard } from '@/app/components/features/kanban-board';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import { Button } from '@/app/components/ui/button';
import { db } from '@/db/client';
import type { Task, TaskColumn } from '@/db/schema/tasks';
import { AgentService } from '@/services/agent.service';
import { ProjectService } from '@/services/project.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const taskService = new TaskService(db, worktreeService);

const sessionService = new SessionService(
  db,
  {
    createStream: async () => undefined,
    publish: async () => undefined,
    subscribe: async function* () {
      yield { type: 'chunk', data: {} };
    },
  },
  { baseUrl: process.env.APP_URL ?? 'http://localhost:5173' }
);

const agentService = new AgentService(db, worktreeService, taskService, sessionService);

const projectService = new ProjectService(db, worktreeService, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

export const Route = createFileRoute('/projects/$projectId/')({
  loader: async ({ params }) => {
    const [projectResult, tasksResult, agentsResult] = await Promise.all([
      projectService.getById(params.projectId),
      taskService.list(params.projectId),
      agentService.list(params.projectId),
    ]);

    if (!projectResult.ok) {
      throw new Error('Project not found');
    }

    return {
      project: projectResult.value,
      tasks: tasksResult.ok ? tasksResult.value : [],
      agents: agentsResult.ok ? agentsResult.value : [],
    };
  },
  component: ProjectKanban,
});

function ProjectKanban(): React.JSX.Element {
  const { project, tasks } = Route.useLoaderData();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showNewTask, setShowNewTask] = useState(false);
  const [approvalTask, setApprovalTask] = useState<Task | null>(null);

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
        onOpenChange={(open: boolean) => {
          if (!open) {
            setSelectedTask(null);
            setShowNewTask(false);
          }
        }}
        onSave={async (data: { title?: string; description?: string }) => {
          if (selectedTask) {
            await taskService.update(selectedTask.id, data);
          } else {
            await taskService.create({
              projectId: project.id,
              title: data.title ?? '',
              description: data.description,
            });
          }
        }}
        onDelete={async (id: string) => {
          await taskService.delete(id);
        }}
      />

      {approvalTask && (
        <ApprovalDialog
          task={approvalTask}
          diff={approvalTask.diffSummary ?? null}
          open={Boolean(approvalTask)}
          onOpenChange={(open: boolean) => {
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
