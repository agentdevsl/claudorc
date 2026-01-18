import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/db/schema/projects';
import { DEFAULT_PROJECT_CONFIG } from '@/lib/config/types';
import { ProjectErrors } from '@/lib/errors/project-errors';
import { err, ok } from '@/lib/utils/result';

const projectServiceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  updateConfig: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('@/services/project.service', () => ({
  ProjectService: class {
    list = projectServiceMocks.list;
    create = projectServiceMocks.create;
    getById = projectServiceMocks.getById;
    update = projectServiceMocks.update;
    updateConfig = projectServiceMocks.updateConfig;
    delete = projectServiceMocks.delete;
  },
}));
vi.mock('@/db/client', () => ({ pglite: {}, sqlite: {}, db: {} }));

import { Route as ProjectsRoute } from '@/app/routes/api/projects';
import { Route as ProjectRoute } from '@/app/routes/api/projects/$id';

const sampleProject: Project = {
  id: 'proj-1',
  name: 'AgentPane',
  path: '/tmp/agentpane',
  description: null,
  config: DEFAULT_PROJECT_CONFIG,
  maxConcurrentAgents: 3,
  githubOwner: null,
  githubRepo: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-02T00:00:00Z'),
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

describe('Project API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists projects with pagination metadata', async () => {
    projectServiceMocks.list.mockResolvedValue(ok([sampleProject]));

    const response = await ProjectsRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/projects?limit=20'),
      params: {},
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{
      ok: true;
      data: { items: Project[]; nextCursor: string | null };
    }>(response as Response);

    expect(data.ok).toBe(true);
    expect(data.data.items).toHaveLength(1);
    expect(data.data.items[0].id).toBe(sampleProject.id);
    expect(typeof data.data.nextCursor === 'string').toBe(true);
  });

  it('rejects invalid list query', async () => {
    const response = await ProjectsRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/projects?limit=0'),
      params: {},
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates a project', async () => {
    projectServiceMocks.create.mockResolvedValue(ok(sampleProject));

    const response = await ProjectsRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/projects', {
        name: sampleProject.name,
        path: sampleProject.path,
      }),
      params: {},
    });

    expect(response?.status).toBe(201);
    const data = await parseJson<{ ok: true; data: Project }>(response as Response);
    expect(data.ok).toBe(true);
    expect(data.data.id).toBe(sampleProject.id);
  });

  it('validates create body', async () => {
    const response = await ProjectsRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/projects', {}),
      params: {},
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.ok).toBe(false);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('gets a project by id', async () => {
    projectServiceMocks.getById.mockResolvedValue(ok(sampleProject));

    const response = await ProjectRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/projects/proj-1'),
      params: { id: sampleProject.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Project }>(response as Response);
    expect(data.data.id).toBe(sampleProject.id);
  });

  it('rejects invalid project id', async () => {
    const response = await ProjectRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/projects/'),
      params: { id: '' },
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('INVALID_ID');
  });

  it('updates project config', async () => {
    projectServiceMocks.update.mockResolvedValue(ok(sampleProject));
    projectServiceMocks.updateConfig.mockResolvedValue(ok(sampleProject));

    const response = await ProjectRoute.options.server?.handlers?.PATCH({
      request: jsonRequest(
        'http://localhost/api/projects/proj-1',
        {
          config: { maxTurns: 75 },
        },
        { method: 'PATCH' }
      ),
      params: { id: sampleProject.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Project }>(response as Response);
    expect(data.data.id).toBe(sampleProject.id);
    expect(projectServiceMocks.update).toHaveBeenCalled();
  });

  it('returns conflict when deleting project with running agents', async () => {
    projectServiceMocks.delete.mockResolvedValue(err(ProjectErrors.HAS_RUNNING_AGENTS(2)));

    const response = await ProjectRoute.options.server?.handlers?.DELETE({
      request: new Request('http://localhost/api/projects/proj-1', {
        method: 'DELETE',
      }),
      params: { id: sampleProject.id },
    });

    expect(response?.status).toBe(409);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('PROJECT_HAS_RUNNING_AGENTS');
  });
});
