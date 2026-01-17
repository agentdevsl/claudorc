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
  pause: vi.fn(),
  resume: vi.fn(),
}));

vi.mock('@/services/task.service', () => ({ TaskService: class {} }));
vi.mock('@/services/worktree.service', () => ({ WorktreeService: class {} }));
vi.mock('@/services/session.service', () => ({ SessionService: class {} }));
vi.mock('@/services/project.service', () => ({ ProjectService: class {} }));
vi.mock('@/services/agent.service', () => ({
  AgentService: class {
    list = agentServiceMocks.list;
    create = agentServiceMocks.create;
    getById = agentServiceMocks.getById;
    update = agentServiceMocks.update;
    delete = agentServiceMocks.delete;
    start = agentServiceMocks.start;
    stop = agentServiceMocks.stop;
    pause = agentServiceMocks.pause;
    resume = agentServiceMocks.resume;
  },
}));
vi.mock('@/db/client', () => ({ pglite: {}, db: {} }));

import { Route as AgentPauseRoute } from '@/app/routes/api/agents/$id/pause';
import { Route as AgentResumeRoute } from '@/app/routes/api/agents/$id/resume';

const sampleAgent: Agent = {
  id: 'agent-1',
  projectId: 'proj-1',
  name: 'Test Agent',
  type: 'task',
  status: 'running',
  config: { allowedTools: [], maxTurns: 50 },
  currentTaskId: 'task-1',
  currentSessionId: 'session-1',
  currentTurn: 10,
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

describe('Agent Lifecycle API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/agents/:id/pause', () => {
    it('pauses a running agent', async () => {
      agentServiceMocks.pause.mockResolvedValue(ok(undefined));

      const response = await AgentPauseRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/agents/agent-1/pause', {
          method: 'POST',
        }),
        params: { id: sampleAgent.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{ ok: true; data: { paused: boolean } }>(response as Response);
      expect(data.data.paused).toBe(true);
      expect(agentServiceMocks.pause).toHaveBeenCalledWith(sampleAgent.id);
    });

    it('returns 404 for non-existent agent', async () => {
      agentServiceMocks.pause.mockResolvedValue(err(AgentErrors.NOT_FOUND));

      const response = await AgentPauseRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/agents/agent-404/pause', {
          method: 'POST',
        }),
        params: { id: 'agent-404' },
      });

      expect(response?.status).toBe(404);
      const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
      expect(data.error.code).toBe('AGENT_NOT_FOUND');
    });
  });

  describe('POST /api/agents/:id/resume', () => {
    it('resumes a paused agent', async () => {
      agentServiceMocks.resume.mockResolvedValue(
        ok({
          runId: 'run-123',
          status: 'paused',
          turnCount: 10,
        })
      );

      const response = await AgentResumeRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/agents/agent-1/resume', {}),
        params: { id: sampleAgent.id },
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{
        ok: true;
        data: { runId: string; status: string; turnCount: number };
      }>(response as Response);
      expect(data.data.runId).toBe('run-123');
      expect(agentServiceMocks.resume).toHaveBeenCalledWith(sampleAgent.id, undefined);
    });

    it('resumes with feedback', async () => {
      agentServiceMocks.resume.mockResolvedValue(
        ok({
          runId: 'run-123',
          status: 'paused',
          turnCount: 10,
        })
      );

      const response = await AgentResumeRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/agents/agent-1/resume', {
          feedback: 'Please continue with the next step',
        }),
        params: { id: sampleAgent.id },
      });

      expect(response?.status).toBe(200);
      expect(agentServiceMocks.resume).toHaveBeenCalledWith(
        sampleAgent.id,
        'Please continue with the next step'
      );
    });

    it('returns 404 for non-existent agent', async () => {
      agentServiceMocks.resume.mockResolvedValue(err(AgentErrors.NOT_FOUND));

      const response = await AgentResumeRoute.options.server?.handlers?.POST({
        request: jsonRequest('http://localhost/api/agents/agent-404/resume', {}),
        params: { id: 'agent-404' },
      });

      expect(response?.status).toBe(404);
      const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
      expect(data.error.code).toBe('AGENT_NOT_FOUND');
    });
  });
});
