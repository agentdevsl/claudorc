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
import fs from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema/index.js';
import { settings } from '../db/schema/settings.js';
import {
  MIGRATION_SQL,
  SANDBOX_MIGRATION_SQL,
  TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL,
} from '../lib/bootstrap/phases/schema.js';
import { createDockerProvider } from '../lib/sandbox/index.js';
import { SANDBOX_DEFAULTS } from '../lib/sandbox/types.js';
import { AgentService } from '../services/agent.service.js';
import { ApiKeyService } from '../services/api-key.service.js';
import { createContainerAgentService } from '../services/container-agent.service.js';
import { DurableStreamsService } from '../services/durable-streams.service.js';
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
  publish: async () => 1,
} as unknown as DurableStreamsService;

// Mock DurableStreamsServer for SessionService
const mockStreamsServer: DurableStreamsServer = {
  createStream: async () => undefined,
  publish: async () => 1, // Returns offset
  subscribe: async function* () {
    yield { type: 'chunk', data: {}, offset: 0 };
  },
};

// DurableStreamsService for SSE and container agent events
const durableStreamsService = new DurableStreamsService(mockStreamsServer);

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

// Update TaskService with real worktreeService for getDiff support
taskService.setWorktreeService({
  getDiff: (worktreeId: string) => worktreeService.getDiff(worktreeId),
  merge: (worktreeId: string, targetBranch?: string) =>
    worktreeService.merge(worktreeId, targetBranch),
  remove: (worktreeId: string) => worktreeService.remove(worktreeId),
});

// Docker provider for sandbox containers (optional - only if Docker is available)
let dockerProvider: ReturnType<typeof createDockerProvider> | null = null;
let containerAgentService: ReturnType<typeof createContainerAgentService> | null = null;

// Step 1: Initialize Docker provider
try {
  dockerProvider = createDockerProvider();
  console.log('[API Server] Docker provider initialized');
} catch (error) {
  // Docker initialization failed - this is expected if Docker isn't installed/running
  console.warn(
    '[API Server] Docker not available, container agent service disabled:',
    error instanceof Error ? error.message : String(error)
  );
}

// Step 2: Create default sandbox (only if Docker is available)
if (dockerProvider) {
  try {
    const existingDefault = await dockerProvider.get('default');
    if (!existingDefault) {
      // Get global sandbox defaults from settings
      interface SandboxDefaults {
        image?: string;
        memoryMb?: number;
        cpuCores?: number;
        idleTimeoutMinutes?: number;
      }
      let defaults: SandboxDefaults | null = null;

      try {
        const globalDefaults = await db.query.settings.findFirst({
          where: eq(settings.key, 'sandbox.defaults'),
        });
        if (globalDefaults?.value) {
          defaults = JSON.parse(globalDefaults.value) as SandboxDefaults;
        }
      } catch (settingsErr) {
        console.warn(
          '[API Server] Failed to load sandbox settings (using defaults):',
          settingsErr instanceof Error ? settingsErr.message : String(settingsErr)
        );
      }

      const defaultImage = defaults?.image ?? SANDBOX_DEFAULTS.image;
      console.log(`[API Server] Checking for default sandbox image: ${defaultImage}`);

      // Check if the image exists
      const imageAvailable = await dockerProvider.isImageAvailable(defaultImage);
      console.log(`[API Server] Image available: ${imageAvailable}`);
      if (imageAvailable) {
        try {
          // Use project data directory for default sandbox workspace (must be Docker-shareable)
          const defaultWorkspacePath = path.join(
            process.cwd(),
            'data',
            'sandbox-workspaces',
            'default'
          );
          await fs.mkdir(defaultWorkspacePath, { recursive: true });

          await dockerProvider.create({
            projectId: 'default',
            projectPath: defaultWorkspacePath,
            image: defaultImage,
            memoryMb: defaults?.memoryMb ?? 2048,
            cpuCores: defaults?.cpuCores ?? 2,
            idleTimeoutMinutes: defaults?.idleTimeoutMinutes ?? 30,
            volumeMounts: [],
          });
          console.log('[API Server] Default global sandbox created');
        } catch (createErr) {
          console.warn('[API Server] Failed to create default sandbox:', createErr);
        }
      } else {
        console.log(
          `[API Server] Default sandbox image '${defaultImage}' not available, skipping default sandbox creation`
        );
      }
    } else {
      console.log('[API Server] Default global sandbox already exists');
    }
  } catch (sandboxErr) {
    // Sandbox setup failed but Docker is still available - container agent can still work
    console.warn(
      '[API Server] Failed to setup default sandbox (container agent still available):',
      sandboxErr instanceof Error ? sandboxErr.message : String(sandboxErr)
    );
  }

  // Step 3: Create ContainerAgentService (only if Docker is available)
  try {
    // Create DurableStreamsService for container agent events
    // Create ContainerAgentService for Docker-based agent execution
    containerAgentService = createContainerAgentService(db, dockerProvider, durableStreamsService);

    // Wire up container agent service to task service
    taskService.setContainerAgentService(containerAgentService);
    console.log('[API Server] ContainerAgentService wired up to TaskService');
  } catch (serviceErr) {
    console.error(
      '[API Server] Failed to create ContainerAgentService:',
      serviceErr instanceof Error ? serviceErr.message : String(serviceErr)
    );
  }
}

// MarketplaceService for plugin marketplace operations
const marketplaceService = new MarketplaceService(db);

// AgentService for agent lifecycle management
const agentService = new AgentService(db, worktreeService, taskService, sessionService);

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
  agentService,
  commandRunner: bunCommandRunner,
  durableStreamsService,
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
