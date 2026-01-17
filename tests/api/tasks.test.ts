import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '@/db/schema/tasks';
import { ProjectErrors } from '@/lib/errors/project-errors';
import { TaskErrors } from '@/lib/errors/task-errors';
import { err, ok } from '@/lib/utils/result';

const taskServiceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  moveColumn: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
}));

vi.mock('@/services/worktree.service', () => ({
  WorktreeService: class {},
}));
vi.mock('@/services/task.service', () => ({
  TaskService: class {
    list = taskServiceMocks.list;
    create = taskServiceMocks.create;
    getById = taskServiceMocks.getById;
    update = taskServiceMocks.update;
    delete = taskServiceMocks.delete;
    moveColumn = taskServiceMocks.moveColumn;
    approve = taskServiceMocks.approve;
    reject = taskServiceMocks.reject;
  },
}));
vi.mock('@/db/client', () => ({ pglite: {}, db: {} }));

import { Route as TasksRoute } from '@/app/routes/api/tasks';
import { Route as TaskRoute } from '@/app/routes/api/tasks/$id';
import { Route as TaskApproveRoute } from '@/app/routes/api/tasks/$id/approve';
import { Route as TaskMoveRoute } from '@/app/routes/api/tasks/$id/move';
import { Route as TaskRejectRoute } from '@/app/routes/api/tasks/$id/reject';

const sampleTask: Task = {
  id: 'task-1',
  projectId: 'proj-1',
  agentId: null,
  sessionId: null,
  worktreeId: null,
  title: 'Test Task',
  description: null,
  column: 'backlog',
  position: 0,
  labels: [],
  branch: null,
  diffSummary: null,
  approvedAt: null,
  approvedBy: null,
  rejectionCount: 0,
  rejectionReason: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
  startedAt: null,
  completedAt: null,
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

describe('Task API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists tasks with counts', async () => {
    taskServiceMocks.list.mockResolvedValue(ok([sampleTask]));

    const response = await TasksRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/tasks?projectId=az2h33gpcldsq0a0wdimza6m'),
      params: {},
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{
      ok: true;
      data: { items: Task[]; counts: Record<string, number> };
    }>(response as Response);

    expect(data.ok).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.counts.backlog).toBe(1);
  });

  it('validates list query', async () => {
    const response = await TasksRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/tasks?projectId=not-cuid'),
      params: {},
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates task in backlog', async () => {
    taskServiceMocks.create.mockResolvedValue(ok(sampleTask));

    const response = await TasksRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks', {
        projectId: 'az2h33gpcldsq0a0wdimza6m',
        title: 'Test Task',
      }),
      params: {},
    });

    expect(response?.status).toBe(201);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.column).toBe('backlog');
  });

  it('returns not found when project missing', async () => {
    taskServiceMocks.create.mockResolvedValue(err(ProjectErrors.NOT_FOUND));

    const response = await TasksRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks', {
        projectId: 'az2h33gpcldsq0a0wdimza6m',
        title: 'Test Task',
      }),
      params: {},
    });

    expect(response?.status).toBe(404);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('gets a task by id', async () => {
    taskServiceMocks.getById.mockResolvedValue(ok(sampleTask));

    const response = await TaskRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/tasks/task-1'),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.id).toBe(sampleTask.id);
  });

  it('updates a task', async () => {
    taskServiceMocks.update.mockResolvedValue(ok({ ...sampleTask, title: 'Updated' }));

    const response = await TaskRoute.options.server?.handlers?.PATCH({
      request: jsonRequest(
        'http://localhost/api/tasks/task-1',
        { title: 'Updated' },
        { method: 'PATCH' }
      ),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.title).toBe('Updated');
  });

  it('deletes a task', async () => {
    taskServiceMocks.delete.mockResolvedValue(ok(undefined));

    const response = await TaskRoute.options.server?.handlers?.DELETE({
      request: new Request('http://localhost/api/tasks/task-1', {
        method: 'DELETE',
      }),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { deleted: boolean } }>(response as Response);
    expect(data.data.deleted).toBe(true);
  });

  it('moves a task between columns', async () => {
    taskServiceMocks.moveColumn.mockResolvedValue(ok({ ...sampleTask, column: 'in_progress' }));

    const response = await TaskMoveRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks/task-1/move', {
        column: 'in_progress',
      }),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.column).toBe('in_progress');
  });

  it('rejects invalid task transition', async () => {
    taskServiceMocks.moveColumn.mockResolvedValue(
      err(TaskErrors.INVALID_TRANSITION('backlog', 'verified'))
    );

    const response = await TaskMoveRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks/task-1/move', {
        column: 'verified',
      }),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('TASK_INVALID_TRANSITION');
  });

  it('approves a task', async () => {
    taskServiceMocks.approve.mockResolvedValue(ok({ ...sampleTask, column: 'verified' }));

    const response = await TaskApproveRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks/task-1/approve', {
        approvedBy: 'user-1',
      }),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.column).toBe('verified');
  });

  it('rejects a task with reason', async () => {
    taskServiceMocks.reject.mockResolvedValue(ok({ ...sampleTask, column: 'in_progress' }));

    const response = await TaskRejectRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks/task-1/reject', {
        reason: 'Needs changes',
      }),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Task }>(response as Response);
    expect(data.data.column).toBe('in_progress');
  });

  it('validates reject body', async () => {
    const response = await TaskRejectRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/tasks/task-1/reject', {}),
      params: { id: sampleTask.id },
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });
});
