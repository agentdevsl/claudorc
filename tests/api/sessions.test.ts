import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@/db/schema/sessions';
import { ProjectErrors } from '@/lib/errors/project-errors';
import { SessionErrors } from '@/lib/errors/session-errors';
import { err, ok } from '@/lib/utils/result';

const sessionServiceMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  close: vi.fn(),
  updatePresence: vi.fn(),
  getActiveUsers: vi.fn(),
  getHistory: vi.fn(),
  subscribe: vi.fn(),
}));

vi.mock('@/services/session.service', () => ({
  SessionService: class {
    list = sessionServiceMocks.list;
    create = sessionServiceMocks.create;
    getById = sessionServiceMocks.getById;
    close = sessionServiceMocks.close;
    updatePresence = sessionServiceMocks.updatePresence;
    getActiveUsers = sessionServiceMocks.getActiveUsers;
    getHistory = sessionServiceMocks.getHistory;
    subscribe = sessionServiceMocks.subscribe;
  },
}));
vi.mock('@/db/client', () => ({ pglite: {}, db: {} }));

import { Route as SessionsRoute } from '@/app/routes/api/sessions';
import { Route as SessionRoute } from '@/app/routes/api/sessions/$id';
import { Route as SessionCloseRoute } from '@/app/routes/api/sessions/$id/close';
import { Route as SessionHistoryRoute } from '@/app/routes/api/sessions/$id/history';
import { Route as SessionPresenceRoute } from '@/app/routes/api/sessions/$id/presence';

const sampleSession: Session = {
  id: 'session-1',
  projectId: 'proj-1',
  taskId: null,
  agentId: null,
  status: 'active',
  title: null,
  url: 'http://localhost:5173/sessions/session-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  closedAt: null,
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

describe('Session API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists sessions', async () => {
    sessionServiceMocks.list.mockResolvedValue(ok([sampleSession]));

    const response = await SessionsRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/sessions'),
      params: {},
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Session[] }>(response as Response);
    expect(data.data).toHaveLength(1);
  });

  it('creates a session', async () => {
    sessionServiceMocks.create.mockResolvedValue(ok({ ...sampleSession, status: 'active' }));

    const response = await SessionsRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/sessions', {
        projectId: 'az2h33gpcldsq0a0wdimza6m',
      }),
      params: {},
    });

    expect(response?.status).toBe(201);
    const data = await parseJson<{ ok: true; data: Session }>(response as Response);
    expect(data.data.id).toBe(sampleSession.id);
  });

  it('returns not found when project missing', async () => {
    sessionServiceMocks.create.mockResolvedValue(err(ProjectErrors.NOT_FOUND));

    const response = await SessionsRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/sessions', {
        projectId: 'az2h33gpcldsq0a0wdimza6m',
      }),
      params: {},
    });

    expect(response?.status).toBe(404);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('PROJECT_NOT_FOUND');
  });

  it('gets a session by id', async () => {
    sessionServiceMocks.getById.mockResolvedValue(ok(sampleSession));

    const response = await SessionRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/sessions/session-1'),
      params: { id: sampleSession.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Session }>(response as Response);
    expect(data.data.id).toBe(sampleSession.id);
  });

  it('closes a session', async () => {
    sessionServiceMocks.close.mockResolvedValue(ok({ ...sampleSession, status: 'closed' }));

    const response = await SessionCloseRoute.options.server?.handlers?.POST({
      request: new Request('http://localhost/api/sessions/session-1/close', {
        method: 'POST',
      }),
      params: { id: sampleSession.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: Session }>(response as Response);
    expect(data.data.status).toBe('closed');
  });

  it('updates presence', async () => {
    sessionServiceMocks.updatePresence.mockResolvedValue(ok(undefined));

    const response = await SessionPresenceRoute.options.server?.handlers?.POST({
      request: jsonRequest('http://localhost/api/sessions/session-1/presence', {
        userId: 'user-1',
        cursor: { x: 1, y: 2 },
      }),
      params: { id: sampleSession.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { updated: boolean } }>(response as Response);
    expect(data.data.updated).toBe(true);
  });

  it('returns presence', async () => {
    sessionServiceMocks.getActiveUsers.mockResolvedValue(
      ok([
        {
          userId: 'user-1',
          lastSeen: 123,
          cursor: { x: 1, y: 2 },
        },
      ])
    );

    const response = await SessionPresenceRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/sessions/session-1/presence'),
      params: { id: sampleSession.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: { userId: string }[] }>(response as Response);
    expect(data.data).toHaveLength(1);
  });

  it('returns history events', async () => {
    sessionServiceMocks.getHistory.mockResolvedValue(ok([{ id: 'evt-1' }] as never));

    const response = await SessionHistoryRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/sessions/session-1/history?startTime=1'),
      params: { id: sampleSession.id },
    });

    expect(response?.status).toBe(200);
    const data = await parseJson<{ ok: true; data: unknown[] }>(response as Response);
    expect(data.data).toHaveLength(1);
  });

  it('returns not found when session missing', async () => {
    sessionServiceMocks.getById.mockResolvedValue(err(SessionErrors.NOT_FOUND));

    const response = await SessionRoute.options.server?.handlers?.GET({
      request: new Request('http://localhost/api/sessions/missing'),
      params: { id: 'missing' },
    });

    expect(response?.status).toBe(404);
    const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
    expect(data.error.code).toBe('SESSION_NOT_FOUND');
  });
});
