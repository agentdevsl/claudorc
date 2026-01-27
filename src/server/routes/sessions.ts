/**
 * Session routes
 */

import { Hono } from 'hono';
import type { DurableStreamsService } from '../../services/durable-streams.service.js';
import type { SessionService } from '../../services/session.service.js';
import { isValidId, json } from '../shared.js';

interface SessionsDeps {
  sessionService: SessionService;
  durableStreamsService?: DurableStreamsService;
}

// Track SSE connections for cleanup
const sseConnections = new Map<string, ReadableStreamDefaultController<Uint8Array>>();

export function createSessionsRoutes({ sessionService, durableStreamsService }: SessionsDeps) {
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

  // GET /api/sessions/:id/stream - Server-Sent Events for real-time session updates
  app.get('/:id/stream', async (c) => {
    const sessionId = c.req.param('id');

    if (!isValidId(sessionId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid session ID format' } },
        400
      );
    }

    // Verify session exists
    const sessionResult = await sessionService.getById(sessionId);
    if (!sessionResult.ok) {
      return json({ ok: false, error: sessionResult.error }, sessionResult.error.status ?? 404);
    }

    // Parse optional offset for resumption
    const offsetParam = c.req.query('offset');
    const fromOffset = offsetParam ? parseInt(offsetParam, 10) : 0;

    // Create SSE stream with keep-alive
    let pingInterval: ReturnType<typeof setInterval> | null = null;
    let unsubscribe: (() => void) | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        // Store controller for this session
        sseConnections.set(sessionId, controller);

        // Send initial connected event
        const connectedData = JSON.stringify({
          type: 'connected',
          sessionId,
          offset: fromOffset,
          timestamp: Date.now(),
        });
        controller.enqueue(new TextEncoder().encode(`data: ${connectedData}\n\n`));

        // Subscribe to durable streams if available
        if (durableStreamsService) {
          unsubscribe = durableStreamsService.addSubscriber(sessionId, (event) => {
            try {
              const eventData = JSON.stringify({
                type: event.type,
                data: event.data,
                timestamp: event.timestamp,
                offset: 0, // TODO: Track real offsets
              });
              controller.enqueue(new TextEncoder().encode(`data: ${eventData}\n\n`));
            } catch (err) {
              // Connection closed - log and clean up
              console.debug(`[SSE] Connection closed for session ${sessionId}:`, err);
              if (unsubscribe) {
                unsubscribe();
                unsubscribe = null;
              }
              sseConnections.delete(sessionId);
            }
          });
        }

        // Send keep-alive ping every 15 seconds
        pingInterval = setInterval(() => {
          try {
            controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
          } catch (err) {
            // Connection closed during ping - log and clean up
            console.debug(`[SSE] Ping failed for session ${sessionId}, cleaning up:`, err);
            if (pingInterval) {
              clearInterval(pingInterval);
              pingInterval = null;
            }
            if (unsubscribe) {
              unsubscribe();
              unsubscribe = null;
            }
            sseConnections.delete(sessionId);
          }
        }, 15000);
      },
      cancel() {
        if (pingInterval) {
          clearInterval(pingInterval);
          pingInterval = null;
        }
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        sseConnections.delete(sessionId);
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
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

  // DELETE /api/sessions/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid session ID format' } },
        400
      );
    }

    try {
      const result = await sessionService.delete(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status ?? 404);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Sessions] Delete error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to delete session' } },
        500
      );
    }
  });

  return app;
}
