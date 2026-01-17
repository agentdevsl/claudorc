import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@/db/schema/agents';
import { AgentErrors } from '@/lib/errors/agent-errors';
import { err, ok } from '@/lib/utils/result';

const agentServiceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
}));

vi.mock('@/services/task.service', () => ({ TaskService: class {} }));
vi.mock('@/services/worktree.service', () => ({ WorktreeService: class {} }));
vi.mock('@/services/session.service', () => ({ SessionService: class {} }));
vi.mock('@/services/agent.service', () => ({
  AgentService: class {
    list = agentServiceMocks.list;
    create = agentServiceMocks.create;
    getById = agentServiceMocks.getById;
    update = agentServiceMocks.update;
    delete = agentServiceMocks.delete;
    start = agentServiceMocks.start;
    stop = agentServiceMocks.stop;
  },
}));
vi.mock('@/db/client', () => ({ db: {} }));

import { Route as AgentsRoute } from '@/app/routes/api/agents';
import { Route as AgentRoute } from '@/app/routes/api/agents/$id';
import { Route as AgentStartRoute } from '@/app/routes/api/agents/$id/start';
import { Route as AgentStatusRoute } from '@/app/routes/api/agents/$id/status';
import { Route as AgentStopRoute } from '@/app/routes/api/agents/$id/stop';

const sampleAgent: Agent = {
  id: 'agent-1',
  projectId: 'proj-1',
  name: 'Test Agent',
  type: 'task',
  status: 'idle',
  config: { allowedTools: [], maxTurns: 50 },
  currentTaskId: null,
  currentSessionId: null,
  currentTurn: 0,
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

describe('Agent API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists agents for a project', async () => {
    agentServiceMocks.list.mockResolvedValue(ok([sampleAgent]));

    const response = await AgentsRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/agents?projectId=az2h33gpcldsq0a0wdimza6m'),
      params: {},
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Agent[] }>(response as Response);
    expect(data.data).toHaveLength(1);
  });

  it('validates agent list query', async () => {
    const response = await AgentsRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/agents'),
      params: {},
    });

    expect(response?.status).toBe(400);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('VALIDATION_ERROR');
  });

  it('creates an agent', async () => {
    agentServiceMocks.create.mockResolvedValue(ok(sampleAgent));

    const response = await AgentsRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/agents', {
        projectId: 'az2h33gpcldsq0a0wdimza6m',
        name: 'Test Agent',
        type: 'task',
      }),
      params: {},
    });

    expect(response?.status).toBe(201);
    const data = await parseJson<{ ok: true; data: Agent }>(response as Response);
    expect(data.data.id).toBe(sampleAgent.id);
  });

  it('gets an agent by id', async () => {
    agentServiceMocks.getById.mockResolvedValue(ok(sampleAgent));

    const response = await AgentRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/agents/agent-1'),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Agent }>(response as Response);
    expect(data.data.id).toBe(sampleAgent.id);
  });

  it('updates an agent', async () => {
    agentServiceMocks.update.mockResolvedValue(ok(sampleAgent));

    const response = await AgentRoute.options.server?.handlers?.PATCH({
      request: jsonRequest(
        'http://localhost/api/agents/agent-1',
        { config: { maxTurns: 75 } },
        { method: 'PATCH' }
      ),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Agent }>(response as Response);
    expect(data.data.id).toBe(sampleAgent.id);
  });

  it('deletes an agent', async () => {
    agentServiceMocks.delete.mockResolvedValue(ok(undefined));

    const response = await AgentRoute.options.server?.handlers?.DELETE({
      request: new Request('http://localhost/api/agents/agent-1', { method: 'DELETE' }),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { deleted: boolean } }>(response as Response);
    expect(data.data.deleted).toBe(true);
  });

  it('starts an agent', async () => {
    agentServiceMocks.start.mockResolvedValue(
      ok({
        agent: sampleAgent,
        task: { id: 'task-1' } as never,
        session: { id: 'session-1' } as never,
        worktree: { id: 'worktree-1' } as never,
      })
    );

    const response = await AgentStartRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/agents/agent-1/start', {
        taskId: 'az2h33gpcldsq0a0wdimza6m',
      }),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { agent: Agent } }>(response as Response);
    expect(data.data.agent.id).toBe(sampleAgent.id);
  });

  it('stops an agent', async () => {
    agentServiceMocks.stop.mockResolvedValue(ok(undefined));

    const response = await AgentStopRoute.options.server?.handlers?.POST({
      request: new Request('http://localhost/api/agents/agent-1/stop', { method: 'POST' }),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { stopped: boolean } }>(response as Response);
    expect(data.data.stopped).toBe(true);
  });

  it('gets agent status', async () => {
    agentServiceMocks.getById.mockResolvedValue(ok({ ...sampleAgent, status: 'running' }));

    const response = await AgentStatusRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/agents/agent-1/status'),
      params: { id: sampleAgent.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { status: string } }>(response as Response);
    expect(data.data.status).toBe('running');
  });

  it('returns not found when agent missing', async () => {
    agentServiceMocks.getById.mockResolvedValue(err(AgentErrors.NOT_FOUND));

    const response = await AgentRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/agents/agent-404'),
      params: { id: 'agent-404' },
    });

    expect(response?.status).toBe(404);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('AGENT_NOT_FOUND');
  });
});
