import { describe, expect, it, vi } from 'vitest';
import { ProjectErrors } from '../../lib/errors/project-errors.js';
import { TaskErrors } from '../../lib/errors/task-errors.js';
import { TaskService } from '../task.service.js';

const createDbMock = () => ({
  query: {
    projects: { findFirst: vi.fn() },
    tasks: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
  delete: vi.fn(() => ({ where: vi.fn() })),
});

const createWorktreeServiceMock = () => ({
  getDiff: vi.fn(),
  merge: vi.fn(),
  remove: vi.fn(),
});

describe('TaskService', () => {
  it('creates task in backlog', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
    db.query.tasks.findFirst.mockResolvedValue(null);

    const returning = vi.fn().mockResolvedValue([{ id: 't1', column: 'backlog', position: 0 }]);
    db.insert.mockReturnValue({ values: vi.fn(() => ({ returning })) });

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.create({ projectId: 'p1', title: 'Task' });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.column).toBe('backlog');
    }
  });

  it('returns error if project missing', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.projects.findFirst.mockResolvedValue(null);

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.create({ projectId: 'p1', title: 'Task' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(ProjectErrors.NOT_FOUND);
    }
  });

  it('rejects invalid column transition', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.tasks.findFirst.mockResolvedValue({ id: 't1', column: 'backlog' });

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.moveColumn('t1', 'verified');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('TASK_INVALID_TRANSITION');
    }
  });

  it('approves task by merging', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.tasks.findFirst.mockResolvedValue({
      id: 't1',
      column: 'waiting_approval',
      worktreeId: 'w1',
      projectId: 'p1',
    });

    worktrees.getDiff.mockResolvedValue({
      ok: true,
      value: { stats: { filesChanged: 1, additions: 1, deletions: 0 } },
    });
    worktrees.merge.mockResolvedValue({ ok: true });
    worktrees.remove.mockResolvedValue({ ok: true });

    db.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 't1' }]) })),
      })),
    });

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.approve('t1', { approvedBy: 'user' });

    expect(result.ok).toBe(true);
  });

  it('rejects with reason', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.tasks.findFirst.mockResolvedValue({
      id: 't1',
      column: 'waiting_approval',
      rejectionCount: 0,
    });

    db.update.mockReturnValue({
      set: vi.fn(() => ({
        where: vi.fn(() => ({ returning: vi.fn().mockResolvedValue([{ id: 't1' }]) })),
      })),
    });

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.reject('t1', { reason: 'needs changes' });

    expect(result.ok).toBe(true);
  });

  it('returns error when approve has no diff', async () => {
    const db = createDbMock();
    const worktrees = createWorktreeServiceMock();
    db.query.tasks.findFirst.mockResolvedValue({
      id: 't1',
      column: 'waiting_approval',
      worktreeId: 'w1',
    });
    worktrees.getDiff.mockResolvedValue({
      ok: true,
      value: { stats: { filesChanged: 0, additions: 0, deletions: 0 } },
    });

    const service = new TaskService(db as never, worktrees as never);
    const result = await service.approve('t1', { approvedBy: 'user' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(TaskErrors.NO_DIFF);
    }
  });
});
