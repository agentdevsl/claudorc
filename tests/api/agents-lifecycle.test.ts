import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Agent } from '@/db/schema/agents';
import { AgentErrors } from '@/lib/errors/agent-errors';
import { err, ok } from '@/lib/utils/result';
import { createAgentsRoutes } from '@/server/routes/agents';

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

let app: ReturnType<typeof createAgentsRoutes>;

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

const jsonRequest = (body: unknown, init?: RequestInit) => ({
  ...init,
  method: init?.method ?? 'POST',
  headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  body: JSON.stringify(body),
});

describe('Agent Lifecycle API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    app = createAgentsRoutes({
      agentService: agentServiceMocks as never,
    });
  });

  describe('POST /api/agents/:id/pause', () => {
    it('pauses a running agent', async () => {
      agentServiceMocks.pause.mockResolvedValue(ok(undefined));

      const response = await app.request('/agent-1/pause', {
        method: 'POST',
      });

      expect(response.status).toBe(200);
      const data = (await response.json()) as { ok: true; data: { paused: boolean } };
      expect(data.data.paused).toBe(true);
      expect(agentServiceMocks.pause).toHaveBeenCalledWith(sampleAgent.id);
    });

    it('returns 404 for non-existent agent', async () => {
      agentServiceMocks.pause.mockResolvedValue(err(AgentErrors.NOT_FOUND));

      const response = await app.request('/agent-404/pause', {
        method: 'POST',
      });

      expect(response.status).toBe(404);
      const data = (await response.json()) as { ok: false; error: { code: string } };
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

      const response = await app.request('/agent-1/resume', jsonRequest({}));

      expect(response.status).toBe(200);
      const data = (await response.json()) as {
        ok: true;
        data: { runId: string; status: string; turnCount: number };
      };
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

      const response = await app.request(
        '/agent-1/resume',
        jsonRequest({
          feedback: 'Please continue with the next step',
        })
      );

      expect(response.status).toBe(200);
      expect(agentServiceMocks.resume).toHaveBeenCalledWith(
        sampleAgent.id,
        'Please continue with the next step'
      );
    });

    it('returns 404 for non-existent agent', async () => {
      agentServiceMocks.resume.mockResolvedValue(err(AgentErrors.NOT_FOUND));

      const response = await app.request('/agent-404/resume', jsonRequest({}));

      expect(response.status).toBe(404);
      const data = (await response.json()) as { ok: false; error: { code: string } };
      expect(data.error.code).toBe('AGENT_NOT_FOUND');
    });
  });
});
