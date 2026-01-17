import { describe, expect, it, vi } from 'vitest';
import { WorktreeService } from '../worktree.service.js';
import { WorktreeErrors } from '../../lib/errors/worktree-errors.js';

const createDbMock = () => ({
  query: {
    projects: {
      findFirst: vi.fn(),
    },
    worktrees: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  delete: vi.fn(() => ({ where: vi.fn() })),
});

describe('WorktreeService', () => {
  it('returns error when project missing', async () => {
    const db = createDbMock();
    db.query.projects.findFirst.mockResolvedValue(null);

    const service = new WorktreeService(db as never, { exec: vi.fn() });
    const result = await service.create({ projectId: 'p1', taskId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WORKTREE_CREATION_FAILED');
    }
  });

  it('returns error when branch exists', async () => {
    const db = createDbMock();
    db.query.projects.findFirst.mockResolvedValue({
      id: 'p1',
      path: '/tmp/project',
      config: { worktreeRoot: '.worktrees' },
    });

    const exec = vi.fn(async () => ({ stdout: 'branch', stderr: '' }));
    const service = new WorktreeService(db as never, { exec });

    const result = await service.create({ projectId: 'p1', taskId: 't1' });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('WORKTREE_BRANCH_EXISTS');
    }
  });

  it('creates worktree record on success', async () => {
    const db = createDbMock();
    db.query.projects.findFirst.mockResolvedValue({
      id: 'p1',
      path: '/tmp/project',
      config: { worktreeRoot: '.worktrees', initScript: undefined },
    });

    const returning = vi
      .fn()
      .mockResolvedValue([
        { id: 'w1', projectId: 'p1', branch: 'agent/x/t1', path: '/tmp/worktree' },
      ]);
    db.insert.mockReturnValue({ values: vi.fn(() => ({ returning })) });

    const exec = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const service = new WorktreeService(db as never, { exec });

    const result = await service.create({ projectId: 'p1', taskId: 't1' }, { skipEnvCopy: true });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe('w1');
    }
  });

  it('returns error when remove cannot find worktree', async () => {
    const db = createDbMock();
    db.query.worktrees.findFirst.mockResolvedValue(null);

    const service = new WorktreeService(db as never, { exec: vi.fn() });
    const result = await service.remove('missing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(WorktreeErrors.NOT_FOUND);
    }
  });

  it('returns ok when list with no worktrees', async () => {
    const db = createDbMock();
    db.query.worktrees.findMany.mockResolvedValue([]);

    const service = new WorktreeService(db as never, { exec: vi.fn() });
    const result = await service.list('p1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual([]);
    }
  });
});
