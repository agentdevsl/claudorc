import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TaskDetailDialog } from '@/app/components/features/task-detail-dialog';
import type { Task } from '@/db/schema/tasks';

const createTask = (overrides: Partial<Task> = {}): Task => ({
  id: overrides.id ?? 'task-1',
  projectId: overrides.projectId ?? 'project-1',
  title: overrides.title ?? 'Test task',
  description: overrides.description ?? null,
  column: overrides.column ?? 'backlog',
  position: overrides.position ?? 0,
  labels: overrides.labels ?? [],
  branch: null,
  diffSummary: null,
  approvedAt: null,
  approvedBy: null,
  rejectionCount: 0,
  rejectionReason: null,
  agentId: null,
  sessionId: null,
  worktreeId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  startedAt: null,
  completedAt: null,
});

describe('TaskDetailDialog', () => {
  it('renders the edit task dialog with title and description fields', () => {
    render(
      <TaskDetailDialog
        task={createTask({ title: 'My task', description: 'Task description' })}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('Edit task')).toBeInTheDocument();
    expect(screen.getByLabelText('Title')).toHaveValue('My task');
    expect(screen.getByLabelText('Description')).toHaveValue('Task description');
  });

  it('renders "New task" title when task is null', () => {
    render(
      <TaskDetailDialog
        task={null}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByText('New task')).toBeInTheDocument();
    expect(screen.getByText('Add details for the new task.')).toBeInTheDocument();
  });

  it('calls onSave with updated title and description', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDetailDialog
        task={createTask({ title: 'Original title', description: 'Original description' })}
        open
        onOpenChange={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    const titleInput = screen.getByLabelText('Title');
    const descriptionInput = screen.getByLabelText('Description');

    fireEvent.change(titleInput, { target: { value: 'Updated title' } });
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        title: 'Updated title',
        description: 'Updated description',
      });
    });
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDetailDialog
        task={createTask({ id: 'task-123' })}
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

  it('closes the dialog after saving', async () => {
    const onOpenChange = vi.fn();
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskDetailDialog
        task={createTask()}
        open
        onOpenChange={onOpenChange}
        onSave={onSave}
        onDelete={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('does not show delete button when task is null', () => {
    render(
      <TaskDetailDialog
        task={null}
        open
        onOpenChange={vi.fn()}
        onSave={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.queryByText('Delete')).not.toBeInTheDocument();
  });

  it('closes the dialog when cancel is clicked', () => {
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

    fireEvent.click(screen.getByText('Cancel'));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
