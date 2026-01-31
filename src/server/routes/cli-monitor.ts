/**
 * CLI Monitor API Routes
 *
 * Daemon → Server: register, heartbeat, ingest, deregister
 * Frontend → Server: status, sessions, stream (SSE)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { CliMonitorService } from '../../services/cli-monitor/cli-monitor.service.js';

// ── Zod Schemas ──

const registerSchema = z.object({
  daemonId: z.string().min(1).max(200),
  pid: z.number().int().positive(),
  version: z.string().min(1).max(50),
  watchPath: z.string().min(1).max(1000),
  capabilities: z.array(z.string()).default([]),
  startedAt: z.number().optional(),
});

const heartbeatSchema = z.object({
  daemonId: z.string().min(1).max(200),
  sessionCount: z.number().int().nonnegative().default(0),
});

const ingestSchema = z.object({
  daemonId: z.string().min(1).max(200),
  sessions: z
    .array(
      z.object({
        sessionId: z.string().min(1),
        filePath: z.string(),
        cwd: z.string(),
        projectName: z.string(),
        projectHash: z.string().optional().default(''),
        status: z.enum(['working', 'waiting_for_approval', 'waiting_for_input', 'idle']),
        messageCount: z.number().int().nonnegative(),
        turnCount: z.number().int().nonnegative(),
        tokenUsage: z.object({
          inputTokens: z.number().nonnegative().default(0),
          outputTokens: z.number().nonnegative().default(0),
          cacheCreationTokens: z.number().nonnegative().default(0),
          cacheReadTokens: z.number().nonnegative().default(0),
          ephemeral5mTokens: z.number().nonnegative().optional(),
          ephemeral1hTokens: z.number().nonnegative().optional(),
        }),
        startedAt: z.number(),
        lastActivityAt: z.number(),
        lastReadOffset: z.number().nonnegative().default(0),
        isSubagent: z.boolean().default(false),
        gitBranch: z.string().optional(),
        goal: z.string().max(500).optional(),
        recentOutput: z.string().max(1000).optional(),
        pendingToolUse: z
          .object({
            toolName: z.string(),
            toolId: z.string(),
          })
          .optional(),
        model: z.string().optional(),
        parentSessionId: z.string().optional(),
      })
    )
    .max(500)
    .default([]),
  removedSessionIds: z.array(z.string()).max(500).default([]),
});

const deregisterSchema = z.object({
  daemonId: z.string().min(1).max(200),
});

// ── Constants ──

const MAX_SSE_CONNECTIONS = 50;
const MAX_BODY_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

let activeSSEConnections = 0;

// ── Helpers ──

function validationError(
  c: { json: (data: unknown, status: number) => Response },
  issues: z.ZodIssue[]
) {
  return c.json(
    {
      ok: false,
      error: { code: 'VALIDATION_ERROR', message: issues[0]?.message ?? 'Invalid payload' },
    },
    400
  );
}

function invalidJsonError(c: { json: (data: unknown, status: number) => Response }) {
  return c.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON body' } }, 400);
}

function checkBodySize(c: {
  req: { header: (name: string) => string | undefined };
  json: (data: unknown, status: number) => Response;
}): Response | null {
  const contentLength = c.req.header('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
    return c.json(
      {
        ok: false,
        error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds 5MB limit' },
      },
      413
    );
  }
  return null;
}

// ── Route Factory ──

interface CliMonitorDeps {
  cliMonitorService: CliMonitorService;
}

export function createCliMonitorRoutes({ cliMonitorService }: CliMonitorDeps) {
  const app = new Hono();

  // ── Daemon → Server ──

  // POST /register — Daemon announces itself
  app.post('/register', async (c) => {
    const sizeError = checkBodySize(c);
    if (sizeError) return sizeError;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return invalidJsonError(c);
    }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      console.warn('[CliMonitor] Register validation failed:', JSON.stringify(parsed.error.issues));
      return validationError(c, parsed.error.issues);
    }
    cliMonitorService.registerDaemon({
      daemonId: parsed.data.daemonId,
      pid: parsed.data.pid,
      version: parsed.data.version,
      watchPath: parsed.data.watchPath,
      capabilities: parsed.data.capabilities,
      startedAt: parsed.data.startedAt || Date.now(),
    });
    return c.json({ ok: true });
  });

  // POST /heartbeat — Daemon keepalive
  app.post('/heartbeat', async (c) => {
    const sizeError = checkBodySize(c);
    if (sizeError) return sizeError;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return invalidJsonError(c);
    }
    const parsed = heartbeatSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.issues);
    }
    const result = cliMonitorService.handleHeartbeat(
      parsed.data.daemonId,
      parsed.data.sessionCount
    );
    if (result === 'ok') {
      return c.json({ ok: true });
    }
    // Tell daemon to re-register so it can recover
    return c.json(
      {
        ok: false,
        error: { code: 'REREGISTER', message: 'Daemon not recognized — please re-register' },
      },
      409
    );
  });

  // POST /ingest — Daemon pushes session updates
  app.post('/ingest', async (c) => {
    const sizeError = checkBodySize(c);
    if (sizeError) return sizeError;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return invalidJsonError(c);
    }
    const parsed = ingestSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.issues);
    }
    const accepted = cliMonitorService.ingestSessions(
      parsed.data.daemonId,
      parsed.data.sessions as never[],
      parsed.data.removedSessionIds
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
    const sizeError = checkBodySize(c);
    if (sizeError) return sizeError;
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return invalidJsonError(c);
    }
    const parsed = deregisterSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(c, parsed.error.issues);
    }
    cliMonitorService.deregisterDaemon(parsed.data.daemonId);
    return c.json({ ok: true });
  });

  // ── Frontend → Server ──

  // GET /status — Check if daemon is connected
  app.get('/status', (c) => {
    return c.json({ ok: true, data: cliMonitorService.getStatus() });
  });

  // GET /sessions — List sessions with optional pagination
  app.get('/sessions', (c) => {
    const limitParam = c.req.query('limit');
    const offsetParam = c.req.query('offset');

    const allSessions = cliMonitorService.getSessions();
    const total = allSessions.length;

    let sessions = allSessions;
    if (limitParam !== undefined || offsetParam !== undefined) {
      const limit = Math.min(Math.max(parseInt(limitParam || '100', 10) || 100, 1), 500);
      const offset = Math.max(parseInt(offsetParam || '0', 10) || 0, 0);
      sessions = allSessions.slice(offset, offset + limit);
    }

    return c.json({
      ok: true,
      data: {
        sessions,
        total,
        connected: cliMonitorService.isDaemonConnected(),
      },
    });
  });

  // GET /stream — SSE endpoint for live updates
  app.get('/stream', (c) => {
    if (activeSSEConnections >= MAX_SSE_CONNECTIONS) {
      return c.json(
        {
          ok: false,
          error: { code: 'TOO_MANY_CONNECTIONS', message: 'SSE connection limit reached' },
        },
        429
      );
    }
    activeSSEConnections++;

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
        activeSSEConnections = Math.max(0, activeSSEConnections - 1);
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
