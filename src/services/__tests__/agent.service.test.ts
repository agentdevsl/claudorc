import { describe, expect, it, vi } from 'vitest';
import { AgentErrors } from '../../lib/errors/agent-errors.js';
import { ConcurrencyErrors } from '../../lib/errors/concurrency-errors.js';
import { ValidationErrors } from '../../lib/errors/validation-errors.js';
import { AgentService } from '../agent.service.js';

const createDbMock = () => ({
  query: {
    projects: { findFirst: vi.fn() },
    agents: { findFirst: vi.fn(), findMany: vi.fn() },
    tasks: { findFirst: vi.fn() },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
});

const createWorktreeServiceMock = () => ({
  create: vi.fn(),
});

const createTaskServiceMock = () => ({
  moveColumn: vi.fn(),
});

const createSessionServiceMock = () => ({
  create: vi.fn(),
  publish: vi.fn(),
});

describe('AgentService', () => {
  it('creates agent with defaults', async () => {
    const db = createDbMock();
    db.query.projects.findFirst.mockResolvedValue({
      id: 'p1',
      config: { allowedTools: ['Read'], maxTurns: 10 },
    });

    const returning = vi
      .fn()
      .mockResolvedValue([
        { id: 'a1', projectId: 'p1', config: { allowedTools: ['Read'], maxTurns: 10 } },
      ]);
    db.insert.mockReturnValue({ values: vi.fn(() => ({ returning })) });

    const service = new AgentService(
      db as never,
      createWorktreeServiceMock() as never,
      createTaskServiceMock() as never,
      createSessionServiceMock() as never
    );
    const result = await service.create({
      projectId: 'p1',
      name: 'Agent',
      type: 'task',
      status: 'idle',
    });

    expect(result.ok).toBe(true);
  });

  it('returns validation error when project missing', async () => {
    const db = createDbMock();
    db.query.projects.findFirst.mockResolvedValue(null);

    const service = new AgentService(
      db as never,
      createWorktreeServiceMock() as never,
      createTaskServiceMock() as never,
      createSessionServiceMock() as never
    );
    const result = await service.create({
      projectId: 'missing',
      name: 'Agent',
      type: 'task',
      status: 'idle',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(ValidationErrors.INVALID_ID('projectId'));
    }
  });

  it('returns error when agent missing', async () => {
    const db = createDbMock();
    db.query.agents.findFirst.mockResolvedValue(null);

    const service = new AgentService(
      db as never,
      createWorktreeServiceMock() as never,
      createTaskServiceMock() as never,
      createSessionServiceMock() as never
    );
    const result = await service.getById('missing');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(AgentErrors.NOT_FOUND);
    }
  });

  it('fails start when concurrency exceeded', async () => {
    const db = createDbMock();
    db.query.agents.findFirst.mockResolvedValue({ id: 'a1', status: 'idle', projectId: 'p1' });
    db.query.tasks.findFirst.mockResolvedValue({ id: 't1', column: 'backlog' });
    db.query.projects.findFirst.mockResolvedValue({ id: 'p1', maxConcurrentAgents: 1 });
    db.query.agents.findMany.mockResolvedValue([{ id: 'a2', status: 'running' }]);

    const service = new AgentService(
      db as never,
      createWorktreeServiceMock() as never,
      createTaskServiceMock() as never,
      createSessionServiceMock() as never
    );
    const result = await service.start('a1', 't1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(ConcurrencyErrors.LIMIT_EXCEEDED(1, 1));
    }
  });

  it('returns not running on stop when missing controller', async () => {
    const db = createDbMock();
    db.query.agents.findFirst.mockResolvedValue({ id: 'a1', status: 'idle' });

    const service = new AgentService(
      db as never,
      createWorktreeServiceMock() as never,
      createTaskServiceMock() as never,
      createSessionServiceMock() as never
    );
    const result = await service.stop('a1');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual(AgentErrors.NOT_RUNNING);
    }
  });
});
