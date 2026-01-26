/**
 * Hono API Router
 *
 * Main router that combines all route modules.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { ApiKeyService } from '../services/api-key.service.js';
import type { GitHubTokenService } from '../services/github-token.service.js';
import type { MarketplaceService } from '../services/marketplace.service.js';
import type { SandboxConfigService } from '../services/sandbox-config.service.js';
import type { SessionService } from '../services/session.service.js';
import type { TaskService } from '../services/task.service.js';
import type { TaskCreationService } from '../services/task-creation.service.js';
import type { TemplateService } from '../services/template.service.js';
import type { CommandRunner, WorktreeService } from '../services/worktree.service.js';
// Types
import type { Database } from '../types/database.js';
import { createApiKeysRoutes } from './routes/api-keys.js';
import { createFilesystemRoutes } from './routes/filesystem.js';
import { createGitRoutes } from './routes/git.js';
import { createGitHubRoutes } from './routes/github.js';
// Route modules
import { createHealthRoutes } from './routes/health.js';
import { createMarketplacesRoutes } from './routes/marketplaces.js';
import { createProjectsRoutes } from './routes/projects.js';
import { createK8sRoutes, createSandboxRoutes } from './routes/sandbox.js';
import { createSessionsRoutes } from './routes/sessions.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createTaskCreationRoutes } from './routes/task-creation.js';
import { createTasksRoutes } from './routes/tasks.js';
import { createTemplatesRoutes } from './routes/templates.js';
import { createWorkflowDesignerRoutes } from './routes/workflow-designer.js';
import { createWorkflowsRoutes } from './routes/workflows.js';
import { createWorktreesRoutes } from './routes/worktrees.js';

export interface RouterDependencies {
  db: Database;
  githubService: GitHubTokenService;
  apiKeyService: ApiKeyService;
  templateService: TemplateService;
  sandboxConfigService: SandboxConfigService;
  taskService: TaskService;
  sessionService: SessionService;
  taskCreationService: TaskCreationService;
  worktreeService: WorktreeService;
  marketplaceService: MarketplaceService;
  commandRunner: CommandRunner;
}

/**
 * Create the main Hono app with all routes
 */
export function createRouter(deps: RouterDependencies) {
  const app = new Hono();

  // Global middleware
  app.use(
    '*',
    cors({
      origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
      allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    })
  );
  app.use('*', logger());

  // Mount route modules
  app.route(
    '/api/health',
    createHealthRoutes({
      db: deps.db,
      githubService: deps.githubService,
    })
  );

  app.route(
    '/api/settings',
    createSettingsRoutes({
      db: deps.db,
    })
  );

  app.route(
    '/api/projects',
    createProjectsRoutes({
      db: deps.db,
    })
  );

  app.route(
    '/api/tasks/create-with-ai',
    createTaskCreationRoutes({
      taskCreationService: deps.taskCreationService,
    })
  );

  app.route(
    '/api/tasks',
    createTasksRoutes({
      taskService: deps.taskService,
    })
  );

  app.route(
    '/api/workflows',
    createWorkflowsRoutes({
      db: deps.db,
    })
  );

  app.route(
    '/api/templates',
    createTemplatesRoutes({
      templateService: deps.templateService,
    })
  );

  app.route(
    '/api/marketplaces',
    createMarketplacesRoutes({
      marketplaceService: deps.marketplaceService,
    })
  );

  app.route(
    '/api/sessions',
    createSessionsRoutes({
      sessionService: deps.sessionService,
    })
  );

  app.route(
    '/api/worktrees',
    createWorktreesRoutes({
      worktreeService: deps.worktreeService,
    })
  );

  app.route(
    '/api/github',
    createGitHubRoutes({
      githubService: deps.githubService,
    })
  );

  app.route(
    '/api/git',
    createGitRoutes({
      db: deps.db,
      commandRunner: deps.commandRunner,
    })
  );

  app.route(
    '/api/sandbox-configs',
    createSandboxRoutes({
      sandboxConfigService: deps.sandboxConfigService,
    })
  );

  app.route('/api/sandbox/k8s', createK8sRoutes());

  app.route(
    '/api/keys',
    createApiKeysRoutes({
      apiKeyService: deps.apiKeyService,
    })
  );

  app.route('/api/filesystem', createFilesystemRoutes());

  app.route(
    '/api/workflow-designer',
    createWorkflowDesignerRoutes({
      templateService: deps.templateService,
    })
  );

  // Global error handler to catch uncaught exceptions
  app.onError((err, c) => {
    console.error('[API] Unhandled error:', err);

    // Determine error message based on environment
    const isProduction = process.env.NODE_ENV === 'production';
    let message = 'Internal server error';
    if (isProduction) {
      message = 'An unexpected error occurred.';
    } else if (err instanceof Error) {
      message = err.message;
    }

    return c.json(
      {
        ok: false,
        error: {
          code: 'INTERNAL_ERROR',
          message,
        },
      },
      500
    );
  });

  // 404 handler for unmatched routes
  app.notFound((c) => {
    return c.json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
  });

  return app;
}
