/**
 * Sandbox Status routes
 *
 * Provides API endpoint for getting sandbox mode and container status.
 */

import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { settings } from '../../db/schema/settings.js';
import type { EventEmittingSandboxProvider } from '../../lib/sandbox/index.js';
import type { Database } from '../../types/database.js';
import { isValidId, json } from '../shared.js';

interface SandboxStatusDeps {
  db: Database;
  dockerProvider: EventEmittingSandboxProvider | null;
}

export function createSandboxStatusRoutes({ db, dockerProvider }: SandboxStatusDeps) {
  const app = new Hono();

  // GET /api/sandbox/status/:projectId - Get sandbox mode and container status
  app.get('/:projectId', async (c) => {
    const projectId = c.req.param('projectId');

    if (!isValidId(projectId)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid project ID' } }, 400);
    }

    try {
      // Get sandbox mode from settings
      const modeSetting = await db.query.settings.findFirst({
        where: eq(settings.key, 'sandbox.mode'),
      });
      const sandboxMode = modeSetting?.value ? JSON.parse(modeSetting.value) : 'shared';

      // Get container status from docker provider
      let containerStatus: 'stopped' | 'creating' | 'running' | 'idle' | 'error' | 'unavailable' =
        'unavailable';
      let containerId: string | null = null;

      if (dockerProvider) {
        try {
          // In shared mode, check the default sandbox
          // In per-project mode, check the project-specific sandbox
          const lookupId = sandboxMode === 'shared' ? 'default' : projectId;
          const sandbox = await dockerProvider.get(lookupId);
          if (sandbox) {
            containerStatus = sandbox.status as typeof containerStatus;
            containerId = sandbox.containerId ?? null;
          } else {
            containerStatus = 'stopped';
          }
        } catch {
          containerStatus = 'error';
        }
      }

      return json({
        ok: true,
        data: {
          mode: sandboxMode,
          containerStatus,
          containerId,
          dockerAvailable: !!dockerProvider,
        },
      });
    } catch (error) {
      console.error('[SandboxStatus] Error:', error);
      return json(
        { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get sandbox status' } },
        500
      );
    }
  });

  return app;
}
