/**
 * Session routes
 */

import { Hono } from 'hono';
import type { SessionService } from '../../services/session.service.js';
import { isValidId, json } from '../shared.js';

interface SessionsDeps {
  sessionService: SessionService;
}

export function createSessionsRoutes({ sessionService }: SessionsDeps) {
  const app = new Hono();

  // GET /api/sessions
  app.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    try {
      const result = await sessionService.list({ limit, offset });
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status ?? 400);
      }

      return json({
        ok: true,
        data: result.value,
        pagination: {
          limit,
          offset,
          hasMore: result.value.length === limit,
        },
      });
    } catch (error) {
      console.error('[Sessions] List error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to list sessions' } },
        500
      );
    }
  });

  // GET /api/sessions/:id/events
  app.get('/:id/events', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid session ID format' } },
        400
      );
    }

    const limit = parseInt(c.req.query('limit') ?? '100', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    try {
      const result = await sessionService.getEventsBySession(id, { limit, offset });
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status ?? 404);
      }

      return json({
        ok: true,
        data: result.value,
        pagination: { total: result.value.length, limit, offset },
      });
    } catch (error) {
      console.error('[Sessions] Get events error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session events' } },
        500
      );
    }
  });

  // GET /api/sessions/:id/summary
  app.get('/:id/summary', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid session ID format' } },
        400
      );
    }

    try {
      const result = await sessionService.getSessionSummary(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status ?? 404);
      }

      // Return default values if no summary exists yet
      const summary = result.value ?? {
        sessionId: id,
        durationMs: null,
        turnsCount: 0,
        tokensUsed: 0,
        filesModified: 0,
        linesAdded: 0,
        linesRemoved: 0,
        finalStatus: null,
      };

      return json({ ok: true, data: summary });
    } catch (error) {
      console.error('[Sessions] Get summary error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session summary' } },
        500
      );
    }
  });

  // GET /api/sessions/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid session ID format' } },
        400
      );
    }

    try {
      const result = await sessionService.getById(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status ?? 404);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Sessions] Get error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session' } },
        500
      );
    }
  });

  return app;
}
