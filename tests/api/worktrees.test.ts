import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Worktree, WorktreeStatus } from '@/db/schema/worktrees';
import { WorktreeErrors } from '@/lib/errors/worktree-errors';
import { err, ok } from '@/lib/utils/result';

const worktreeServiceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getStatus: vi.fn(),
  remove: vi.fn(),
  getDiff: vi.fn(),
  commit: vi.fn(),
  merge: vi.fn(),
  prune: vi.fn(),
}));

vi.mock('@/services/project.service', () => ({ ProjectService: class {} }));
vi.mock('@/services/task.service', () => ({ TaskService: class {} }));
vi.mock('@/services/session.service', () => ({ SessionService: class {} }));
vi.mock('@/services/agent.service', () => ({ AgentService: class {} }));
vi.mock('@/services/worktree.service', () => ({
  WorktreeService: class {
    list = worktreeServiceMocks.list;
    create = worktreeServiceMocks.create;
    getStatus = worktreeServiceMocks.getStatus;
    remove = worktreeServiceMocks.remove;
    getDiff = worktreeServiceMocks.getDiff;
    commit = worktreeServiceMocks.commit;
    merge = worktreeServiceMocks.merge;
    prune = worktreeServiceMocks.prune;
  },
}));
vi.mock('@/db/client', () => ({ pglite: {}, db: {} }));

import { Route as WorktreeRoute } from '@/app/routes/api/worktrees/$id';
import { Route as WorktreeCommitRoute } from '@/app/routes/api/worktrees/$id/commit';
import { Route as WorktreeDiffRoute } from '@/app/routes/api/worktrees/$id/diff';
import { Route as WorktreeMergeRoute } from '@/app/routes/api/worktrees/$id/merge';
import { Route as WorktreesRoute } from '@/app/routes/api/worktrees/index';
import { Route as WorktreesPruneRoute } from '@/app/routes/api/worktrees/prune';

const sampleWorktree: Worktree = {
  id: 'worktree-1',
  projectId: 'proj-1',
  taskId: 'task-1',
  branch: 'agent/abc123/task-1',
  path: '/tmp/worktrees/agent-abc123-task-1',
  baseBranch: 'main',
  status: 'active' as WorktreeStatus,
  mergedAt: null,
  removedAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
};

const sampleWorktreeStatus = {
  id: sampleWorktree.id,
  branch: sampleWorktree.branch,
  status: sampleWorktree.status,
  path: sampleWorktree.path,
  updatedAt: sampleWorktree.updatedAt,
};

const jsonRequest = (url: string, body: unknown, init?: RequestInit): Request =>
  new Request(url, {
    ...init,
    method: init?.method ?? 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
  });

const parseJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

describe('Worktree API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/worktrees', () => {
    it('lists worktrees for a project', async () => {
      worktreeServiceMocks.list.mockResolvedValue(ok([sampleWorktreeStatus]));

      const response = await WorktreesRoute.options.server?.handlers?.GET({
        request: new Request('http://localhost/api/worktrees?projectId=az2h33gpcldsq0a0wdimza6m'),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: (typeof sampleWorktreeStatus)[] }>(
        response as Response
      );
      expect(data.data).toHaveLength(1);
      expect(data.data[0].id).toBe(sampleWorktree.id);
    });

    it('validates projectId is required', async () => {
      const response = await WorktreesRoute.options.server?.handlers?.GET({
        request: new Request('http://localhost/api/worktrees'),
        params: {},
      });

      expect(response?.status).toBe(400);
    });
  });

  describe('POST /api/worktrees', () => {
    it('creates a worktree', async () => {
      worktreeServiceMocks.create.mockResolvedValue(ok(sampleWorktree));

      const response = await WorktreesRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/worktrees', {
          projectId: 'az2h33gpcldsq0a0wdimza6m',
          taskId: 'bz3h44gpcldsq0a0xdimza7n',
        }),
        params: {},
      });

      expect(response?.status).toBe(201);
      const data = await parseJson<{ ok: true; data: Worktree }>(response as Response);
      expect(data.data.id).toBe(sampleWorktree.id);
    });
  });

  describe('GET /api/worktrees/:id', () => {
    it('gets worktree status', async () => {
      worktreeServiceMocks.getStatus.mockResolvedValue(ok(sampleWorktreeStatus));

      const response = await WorktreeRoute.options.server?.handlers?.GET({
        request: new Request('http://localhost/api/worktrees/worktree-1'),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: typeof sampleWorktreeStatus }>(
        response as Response
      );
      expect(data.data.id).toBe(sampleWorktree.id);
    });

    it('returns 404 for missing worktree', async () => {
      worktreeServiceMocks.getStatus.mockResolvedValue(err(WorktreeErrors.NOT_FOUND));

      const response = await WorktreeRoute.options.server?.handlers?.GET({
        request: new Request('http://localhost/api/worktrees/worktree-404'),
        params: { id: 'worktree-404' },
      });

      expect(response?.status).toBe(404);
    });
  });

  describe('DELETE /api/worktrees/:id', () => {
    it('removes a worktree', async () => {
      worktreeServiceMocks.remove.mockResolvedValue(ok(undefined));

      const response = await WorktreeRoute.options.server?.handlers?.DELETE({
        request: new Request('http://localhost/api/worktrees/worktree-1', {
          method: 'DELETE',
        }),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: { deleted: boolean } }>(response as Response);
      expect(data.data.deleted).toBe(true);
    });
  });

  describe('GET /api/worktrees/:id/diff', () => {
    it('gets worktree diff', async () => {
      const diff = {
        files: [
          { path: 'src/index.ts', status: 'modified', additions: 5, deletions: 2, hunks: [] },
        ],
        stats: { filesChanged: 1, additions: 5, deletions: 2 },
      };
      worktreeServiceMocks.getDiff.mockResolvedValue(ok(diff));

      const response = await WorktreeDiffRoute.options.server?.handlers?.GET({
        request: new Request('http://localhost/api/worktrees/worktree-1/diff'),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: typeof diff }>(response as Response);
      expect(data.data.stats.filesChanged).toBe(1);
    });
  });

  describe('POST /api/worktrees/:id/commit', () => {
    it('commits changes', async () => {
      const sha = 'abc123def456';
      worktreeServiceMocks.commit.mockResolvedValue(ok(sha));

      const response = await WorktreeCommitRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/worktrees/worktree-1/commit', {
          message: 'feat: add new feature',
        }),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: { sha: string } }>(response as Response);
      expect(data.data.sha).toBe(sha);
    });

    it('validates message is required', async () => {
      const response = await WorktreeCommitRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/worktrees/worktree-1/commit', {}),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(400);
    });
  });

  describe('POST /api/worktrees/:id/merge', () => {
    it('merges worktree to target branch', async () => {
      worktreeServiceMocks.merge.mockResolvedValue(ok(undefined));

      const response = await WorktreeMergeRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/worktrees/worktree-1/merge', {
          targetBranch: 'develop',
        }),
        params: { id: sampleWorktree.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: { merged: boolean } }>(response as Response);
      expect(data.data.merged).toBe(true);
    });
  });

  describe('POST /api/worktrees/prune', () => {
    it('prunes stale worktrees', async () => {
      worktreeServiceMocks.prune.mockResolvedValue(ok({ pruned: 2, failed: [] }));

      const response = await WorktreesPruneRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/worktrees/prune', {
          projectId: 'az2h33gpcldsq0a0wdimza6m',
        }),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: { pruned: number } }>(response as Response);
      expect(data.data.pruned).toBe(2);
    });
  });
});
