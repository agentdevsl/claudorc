/**
 * Health check routes
 */

import { Hono } from 'hono';
import type { GitHubTokenService } from '../../services/github-token.service.js';
import type { Database } from '../../types/database.js';
import { json } from '../shared.js';

interface SandboxInfo {
  id: string;
  projectId: string;
  containerId: string;
  status: string;
}

interface SandboxProvider {
  list: () => Promise<SandboxInfo[]>;
}

interface HealthDeps {
  db: Database;
  githubService: GitHubTokenService;
  sandboxProvider?: SandboxProvider | null;
}

export function createHealthRoutes({ db, githubService, sandboxProvider }: HealthDeps) {
  const app = new Hono();

  app.get('/', async (_c) => {
    const startTime = Date.now();
    const checks: {
      database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
      github: { status: 'ok' | 'error' | 'not_configured'; login?: string | null };
      sandbox: {
        status: 'ok' | 'error' | 'not_configured';
        containerId?: string;
        containerCount?: number;
        error?: string;
      };
    } = {
      database: { status: 'error' },
      github: { status: 'not_configured' },
      sandbox: { status: 'not_configured' },
    };

    // Check database connectivity
    try {
      const dbStart = Date.now();
      const result = await db.query.projects.findFirst();
      checks.database = {
        status: 'ok',
        latencyMs: Date.now() - dbStart,
      };
      void result;
    } catch (error) {
      checks.database = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Database query failed',
      };
    }

    // Check GitHub token status
    try {
      const tokenResult = await githubService.getTokenInfo();
      if (tokenResult.ok && tokenResult.value) {
        checks.github = {
          status: tokenResult.value.isValid ? 'ok' : 'error',
          login: tokenResult.value.githubLogin,
        };
      } else if (!tokenResult.ok) {
        checks.github = { status: 'error' };
        console.debug('[Health] GitHub token error:', tokenResult.error.message);
      }
    } catch (error) {
      checks.github = { status: 'error' };
      console.debug(
        '[Health] GitHub token check failed:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    // Check sandbox availability
    if (sandboxProvider) {
      try {
        const sandboxes = await sandboxProvider.list();
        const runningSandboxes = sandboxes.filter((s) => s.status === 'running');

        const firstRunning = runningSandboxes[0];
        const firstSandbox = sandboxes[0];

        if (firstRunning) {
          checks.sandbox = {
            status: 'ok',
            containerId: firstRunning.containerId,
            containerCount: runningSandboxes.length,
          };
        } else if (firstSandbox) {
          checks.sandbox = {
            status: 'error',
            containerId: firstSandbox.containerId,
            containerCount: sandboxes.length,
            error: `No running containers (${sandboxes.length} total, status: ${firstSandbox.status})`,
          };
        } else {
          checks.sandbox = {
            status: 'ok', // No sandboxes is OK - they're created on demand
            containerCount: 0,
          };
        }
      } catch (error) {
        checks.sandbox = {
          status: 'error',
          error: error instanceof Error ? error.message : 'Sandbox check failed',
        };
      }
    }

    const allOk = checks.database.status === 'ok';

    return json({
      ok: allOk,
      data: {
        status: allOk ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks,
        responseTimeMs: Date.now() - startTime,
      },
    });
  });

  return app;
}
