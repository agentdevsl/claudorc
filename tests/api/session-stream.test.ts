import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Session } from '../../src/db/schema';
import { SessionErrors } from '../../src/lib/errors/session-errors.js';
import { err, ok } from '../../src/lib/utils/result.js';
import { createSessionsRoutes } from '../../src/server/routes/sessions.js';

const sessionServiceMocks = vi.hoisted(() => ({
  getById: vi.fn(),
}));

describe('Session stream API', () => {
  let app: ReturnType<typeof createSessionsRoutes>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createSessionsRoutes({
      sessionService: sessionServiceMocks as never,
    });
  });

  it('returns 404 when session is missing', async () => {
    sessionServiceMocks.getById.mockResolvedValue(err(SessionErrors.NOT_FOUND));

    const response = await app.request('http://localhost/session-1/stream');

    expect(response.status).toBe(404);
    const body = (await response.json()) as { ok: false; error: { code: string } };
    expect(body.error.code).toBe('SESSION_NOT_FOUND');
  });

  it('returns a stream when session exists', async () => {
    const session = {
      id: 'session-1',
      projectId: 'proj-1',
      taskId: null,
      agentId: null,
      status: 'active',
      title: null,
      url: 'http://localhost:5173/sessions/session-1',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-02T00:00:00Z',
      closedAt: null,
    } as Session;
    sessionServiceMocks.getById.mockResolvedValue(ok(session));

    const response = await app.request('http://localhost/session-1/stream');

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
  });
});
