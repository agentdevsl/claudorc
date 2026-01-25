/**
 * Health check routes
 */

import { Hono } from 'hono';
import type { GitHubTokenService } from '../../services/github-token.service.js';
import type { Database } from '../../types/database.js';
import { json } from '../shared.js';

interface HealthDeps {
  db: Database;
  githubService: GitHubTokenService;
}

export function createHealthRoutes({ db, githubService }: HealthDeps) {
  const app = new Hono();

  app.get('/', async (_c) => {
    const startTime = Date.now();
    const checks: {
      database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
      github: { status: 'ok' | 'error' | 'not_configured'; login?: string | null };
    } = {
      database: { status: 'error' },
      github: { status: 'not_configured' },
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
