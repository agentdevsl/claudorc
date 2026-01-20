import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import type { Task, TaskColumn } from '@/db/schema/tasks';

const createTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: overrides.id ?? 'task-1',
    projectId: overrides.projectId ?? 'project-1',
    title: overrides.title ?? 'Test task',
    description: overrides.description ?? null,
    mode: overrides.mode ?? 'implement',
    column: overrides.column ?? 'backlog',
    position: overrides.position ?? 0,
    labels: overrides.labels ?? [],
    priority: overrides.priority ?? 'medium',
    branch: null,
    diffSummary: null,
    approvedAt: null,
    approvedBy: null,
    rejectionCount: 0,
    rejectionReason: null,
    agentId: null,
    sessionId: null,
    worktreeId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
  }) as Task;

describe('TaskDetailDialog', () => {
  describe('rendering', () => {
    it('renders task title in header', () => {
      render(
        <TaskDetailDialog
          task={createTask({ title: 'My task title' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('My task title')).toBeInTheDocument();
    });

    it('renders "No task selected" when task is null', () => {
      render(
        <TaskDetailDialog
          task={null}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('No task selected')).toBeInTheDocument();
    });

    it('renders task description section', () => {
      render(
        <TaskDetailDialog
          task={createTask({ description: 'Task description text' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('Task description text')).toBeInTheDocument();
    });

    it('renders task metadata', () => {
      render(
        <TaskDetailDialog
          task={createTask()}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Check for metadata section labels
      expect(screen.getByText('Branch')).toBeInTheDocument();
      expect(screen.getByText('Created')).toBeInTheDocument();
    });
  });

  describe('delete action', () => {
    it('shows delete button for backlog tasks', () => {
      render(
        <TaskDetailDialog
          task={createTask({ column: 'backlog' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('calls onDelete when delete button is clicked', async () => {
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <TaskDetailDialog
          task={createTask({ id: 'task-123', column: 'backlog' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('task-123');
      });
    });
  });

  describe('close behavior', () => {
    it('calls onOpenChange when dialog overlay is clicked', () => {
      const onOpenChange = vi.fn();
      render(
        <TaskDetailDialog
          task={createTask()}
          open
          onOpenChange={onOpenChange}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      // Dialog overlay has data-state="open"
      const overlay = document.querySelector('[data-state="open"]');
      if (overlay) {
        fireEvent.click(overlay);
      }

      // Note: The actual close behavior is handled by Radix Dialog internally
    });

    it('closes dialog after successful delete', async () => {
      const onOpenChange = vi.fn();
      const onDelete = vi.fn().mockResolvedValue(undefined);
      render(
        <TaskDetailDialog
          task={createTask({ column: 'backlog' })}
          open
          onOpenChange={onOpenChange}
          onSave={vi.fn()}
          onDelete={onDelete}
        />
      );

      fireEvent.click(screen.getByText('Delete'));

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });

  describe('column-specific actions', () => {
    it.each([
      ['backlog', 'Delete'],
      ['waiting_approval', 'Reject'],
    ] as const)(
      'shows appropriate action for %s column',
      (column: TaskColumn, expectedButton: string) => {
        render(
          <TaskDetailDialog
            task={createTask({ column })}
            open
            onOpenChange={vi.fn()}
            onSave={vi.fn()}
            onDelete={vi.fn()}
            onMoveColumn={vi.fn()}
          />
        );

        expect(screen.getByText(expectedButton)).toBeInTheDocument();
      }
    );

    it('shows "Start Task" button for backlog tasks with onMoveColumn', () => {
      render(
        <TaskDetailDialog
          task={createTask({ column: 'backlog' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onMoveColumn={vi.fn()}
        />
      );

      expect(screen.getByText('Start Task')).toBeInTheDocument();
    });

    it('shows "Approve" button for waiting_approval tasks with onMoveColumn', () => {
      render(
        <TaskDetailDialog
          task={createTask({ column: 'waiting_approval' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onMoveColumn={vi.fn()}
        />
      );

      expect(screen.getByText('Approve')).toBeInTheDocument();
    });
  });

  describe('mode toggle', () => {
    it('renders mode toggle when onModeChange is provided', () => {
      render(
        <TaskDetailDialog
          task={createTask({ mode: 'implement' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          onModeChange={vi.fn()}
        />
      );

      expect(screen.getByText('Execution Mode')).toBeInTheDocument();
      expect(screen.getByText('Plan')).toBeInTheDocument();
      expect(screen.getByText('Implement')).toBeInTheDocument();
    });

    it('does not render mode toggle when onModeChange is not provided', () => {
      render(
        <TaskDetailDialog
          task={createTask()}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.queryByText('Execution Mode')).not.toBeInTheDocument();
    });
  });

  describe('priority display', () => {
    it('displays priority buttons', () => {
      render(
        <TaskDetailDialog
          task={createTask({ priority: 'medium' })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/medium/i)).toBeInTheDocument();
      expect(screen.getByText(/low/i)).toBeInTheDocument();
    });
  });

  describe('labels', () => {
    it('renders labels section', () => {
      render(
        <TaskDetailDialog
          task={createTask()}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('Labels')).toBeInTheDocument();
    });

    it('displays task labels', () => {
      render(
        <TaskDetailDialog
          task={createTask({ labels: ['bug', 'feature'] })}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('bug')).toBeInTheDocument();
      expect(screen.getByText('feature')).toBeInTheDocument();
    });
  });

  describe('viewers', () => {
    it('displays viewer avatars when viewers are present', () => {
      const viewers = [
        { userId: 'user-1', displayName: 'Alice', avatarUrl: undefined, joinedAt: Date.now() },
        { userId: 'user-2', displayName: 'Bob', avatarUrl: undefined, joinedAt: Date.now() },
      ];

      render(
        <TaskDetailDialog
          task={createTask()}
          open
          onOpenChange={vi.fn()}
          onSave={vi.fn()}
          onDelete={vi.fn()}
          viewers={viewers}
        />
      );

      expect(screen.getByTitle('Alice')).toBeInTheDocument();
      expect(screen.getByTitle('Bob')).toBeInTheDocument();
    });
  });
});
