/**
 * CLI Monitor API Routes
 *
 * Daemon → Server: register, heartbeat, ingest, deregister
 * Frontend → Server: status, sessions, stream (SSE)
 */

import { Hono } from 'hono';
import type { CliMonitorService } from '../../services/cli-monitor/cli-monitor.service.js';

interface CliMonitorDeps {
  cliMonitorService: CliMonitorService;
}

export function createCliMonitorRoutes({ cliMonitorService }: CliMonitorDeps) {
  const app = new Hono();

  // ── Daemon → Server ──

  // POST /register — Daemon announces itself
  app.post('/register', async (c) => {
    const body = await c.req.json();
    cliMonitorService.registerDaemon({
      daemonId: body.daemonId,
      pid: body.pid,
      version: body.version,
      watchPath: body.watchPath,
      capabilities: body.capabilities || [],
      startedAt: body.startedAt || Date.now(),
    });
    return c.json({ ok: true });
  });

  // POST /heartbeat — Daemon keepalive
  app.post('/heartbeat', async (c) => {
    const body = await c.req.json();
    const accepted = cliMonitorService.handleHeartbeat(body.daemonId, body.sessionCount || 0);
    if (!accepted) {
      return c.json(
        { ok: false, error: { code: 'UNKNOWN_DAEMON', message: 'Daemon not registered' } },
        404
      );
    }
    return c.json({ ok: true });
  });

  // POST /ingest — Daemon pushes session updates
  app.post('/ingest', async (c) => {
    const body = await c.req.json();
    const accepted = cliMonitorService.ingestSessions(
      body.daemonId,
      body.sessions || [],
      body.removedSessionIds || []
    );
    if (!accepted) {
      return c.json(
        { ok: false, error: { code: 'UNKNOWN_DAEMON', message: 'Daemon not registered' } },
        404
      );
    }
    return c.json({ ok: true });
  });

  // POST /deregister — Daemon shutting down
  app.post('/deregister', async (c) => {
    const body = await c.req.json();
    cliMonitorService.deregisterDaemon(body.daemonId);
    return c.json({ ok: true });
  });

  // ── Frontend → Server ──

  // GET /status — Check if daemon is connected
  app.get('/status', (c) => {
    return c.json({ ok: true, data: cliMonitorService.getStatus() });
  });

  // GET /sessions — List all sessions
  app.get('/sessions', (c) => {
    return c.json({
      ok: true,
      data: {
        sessions: cliMonitorService.getSessions(),
        connected: cliMonitorService.isDaemonConnected(),
      },
    });
  });

  // GET /stream — SSE endpoint for live updates
  app.get('/stream', (_c) => {
    let unsubscribe: (() => void) | null = null;
    let pingInterval: ReturnType<typeof setInterval> | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // Stream may be closed
          }
        };

        // 1. Send snapshot
        send({
          type: 'cli-monitor:snapshot',
          sessions: cliMonitorService.getSessions(),
          daemon: cliMonitorService.getDaemon(),
          connected: cliMonitorService.isDaemonConnected(),
        });

        // 2. Subscribe to live updates
        unsubscribe = cliMonitorService.addRealtimeSubscriber((event) => {
          send(event.data);
        });

        // 3. Keep-alive ping every 15s
        pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            // Stream closed
          }
        }, 15_000);
      },
      cancel() {
        if (pingInterval) clearInterval(pingInterval);
        if (unsubscribe) unsubscribe();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  });

  return app;
}
