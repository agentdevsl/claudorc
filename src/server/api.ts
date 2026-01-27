/**
 * Bun API Server
 *
 * Handles API requests that need database access.
 * Runs alongside Vite dev server.
 */

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  console.error('[API Server] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[API Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

import { Database as BunSQLite } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema/index.js';
import {
  MIGRATION_SQL,
  SANDBOX_MIGRATION_SQL,
  TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL,
} from '../lib/bootstrap/phases/schema.js';
import { ApiKeyService } from '../services/api-key.service.js';
import type { DurableStreamsService } from '../services/durable-streams.service.js';
import { GitHubTokenService } from '../services/github-token.service.js';
import { MarketplaceService } from '../services/marketplace.service.js';
import { SandboxConfigService } from '../services/sandbox-config.service.js';
import { type DurableStreamsServer, SessionService } from '../services/session.service.js';
import { TaskService } from '../services/task.service.js';
import {
  createTaskCreationService,
  type TaskCreationService,
} from '../services/task-creation.service.js';
import { TemplateService } from '../services/template.service.js';
import { startSyncScheduler } from '../services/template-sync-scheduler.js';
import { type CommandRunner, WorktreeService } from '../services/worktree.service.js';
import type { Database } from '../types/database.js';
import { createRouter } from './router.js';

declare const Bun: {
  spawn: (
    cmd: string[],
    options: { cwd: string; stdout: 'pipe'; stderr: 'pipe' }
  ) => {
    exited: Promise<number>;
    stdout: ReadableStream<Uint8Array>;
    stderr: ReadableStream<Uint8Array>;
  };
  serve: (options: { port: number; fetch: (req: Request) => Response | Promise<Response> }) => void;
};

// Initialize SQLite database using Bun's native SQLite
const DB_PATH = './data/agentpane.db';
const sqlite = new BunSQLite(DB_PATH);

// Run migrations to ensure schema is up to date
sqlite.exec(MIGRATION_SQL);
console.log('[API Server] Schema migrations applied');

// Run sandbox migration (may fail if column already exists)
try {
  sqlite.exec(SANDBOX_MIGRATION_SQL);
  console.log('[API Server] Sandbox migration applied');
} catch (error) {
  // Ignore error if column already exists
  if (!(error instanceof Error && error.message.includes('duplicate column name'))) {
    console.warn('[API Server] Sandbox migration skipped (column may already exist)');
  }
}

// Run template sync interval migration (may fail if columns already exist)
try {
  sqlite.exec(TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL);
  console.log('[API Server] Template sync interval migration applied');
} catch (error) {
  // Ignore error if columns already exist
  if (!(error instanceof Error && error.message.includes('duplicate column name'))) {
    console.warn(
      '[API Server] Template sync interval migration skipped (columns may already exist)'
    );
  }
}

const db = drizzle(sqlite, { schema }) as unknown as Database;

// Initialize services
const githubService = new GitHubTokenService(db);
const apiKeyService = new ApiKeyService(db);
const templateService = new TemplateService(db);
const sandboxConfigService = new SandboxConfigService(db);

// TaskService with stub worktreeService for basic CRUD
const taskService = new TaskService(db, {
  getDiff: async () => ({
    ok: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented', status: 501 },
  }),
  merge: async () => ({
    ok: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented', status: 501 },
  }),
  remove: async () => ({
    ok: false,
    error: { code: 'NOT_IMPLEMENTED', message: 'Not implemented', status: 501 },
  }),
});

// Mock DurableStreamsService for task creation (SSE handled separately)
const mockStreamsService: DurableStreamsService = {
  createStream: async () => undefined,
  publishTaskCreationStarted: async () => undefined,
  publishTaskCreationMessage: async () => undefined,
  publishTaskCreationToken: async () => undefined,
  publishTaskCreationQuestions: async () => undefined,
  publishTaskCreationSuggestion: async () => undefined,
  publishTaskCreationError: async () => undefined,
  publishTaskCreationCompleted: async () => undefined,
  publishTaskCreationCancelled: async () => undefined,
} as unknown as DurableStreamsService;

// Mock DurableStreamsServer for SessionService
const mockStreamsServer: DurableStreamsServer = {
  createStream: async () => undefined,
  publish: async () => 1, // Returns offset
  subscribe: async function* () {
    yield { type: 'chunk', data: {}, offset: 0 };
  },
};

// SessionService for session management (needed for task creation history)
const sessionService = new SessionService(db, mockStreamsServer, {
  baseUrl: 'http://localhost:3001',
});

// TaskCreationService for AI-powered task creation (with session tracking)
const taskCreationService: TaskCreationService = createTaskCreationService(
  db,
  mockStreamsService,
  sessionService
);

// CommandRunner for WorktreeService using Bun.spawn
const bunCommandRunner: CommandRunner = {
  exec: async (command: string, cwd: string) => {
    const proc = Bun.spawn(['sh', '-c', command], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new Error(`Command failed with exit code ${exitCode}: ${stderr || stdout}`);
    }

    return { stdout, stderr };
  },
};

// WorktreeService for git worktree operations
const worktreeService = new WorktreeService(db, bunCommandRunner);

// MarketplaceService for plugin marketplace operations
const marketplaceService = new MarketplaceService(db);

// Create the Hono router with all dependencies
const app = createRouter({
  db,
  githubService,
  apiKeyService,
  templateService,
  sandboxConfigService,
  taskService,
  sessionService,
  taskCreationService,
  worktreeService,
  marketplaceService,
  commandRunner: bunCommandRunner,
});

// Start server
const PORT = 3001;

Bun.serve({
  port: PORT,
  fetch: app.fetch,
});

console.log(`[API Server] Running on http://localhost:${PORT}`);

// Start the template sync scheduler
startSyncScheduler(db, templateService);
console.log('[API Server] Template sync scheduler started');
