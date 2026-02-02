/**
 * Bun API Server
 *
 * Handles API requests that need database access.
 * Runs alongside Vite dev server.
 */

import { createLogger } from '../lib/logging/logger.js';

const log = createLogger('APIServer');

// Global error handlers to prevent crashes
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception', { error });
});

process.on('unhandledRejection', (reason, _promise) => {
  log.error('Unhandled Rejection', { error: reason });
});

// Validate required environment variables at startup
function validateEnv() {
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  if (!process.env.ANTHROPIC_API_KEY && !process.env.CLAUDE_OAUTH_TOKEN) {
    const msg =
      'Neither ANTHROPIC_API_KEY nor CLAUDE_OAUTH_TOKEN is set — agent execution will fail';
    if (isProduction) {
      log.error(msg);
      process.exit(1);
    }
    warnings.push(msg);
  }

  if (isProduction && !process.env.CORS_ORIGIN) {
    warnings.push('CORS_ORIGIN not set — defaulting to http://localhost:3000');
  }

  for (const w of warnings) {
    log.warn(w);
  }

  log.info('Environment validated', {
    data: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasOAuthToken: !!process.env.CLAUDE_OAUTH_TOKEN,
      corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    },
  });
}

validateEnv();

import { Database as BunSQLite } from 'bun:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq, inArray, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { agents } from '../db/schema/agents.js';
import * as schema from '../db/schema/index.js';
import { settings } from '../db/schema/settings.js';
import { tasks } from '../db/schema/tasks.js';
import {
  CLI_SESSIONS_MIGRATION_SQL,
  CLI_SESSIONS_PERF_METRICS_MIGRATION_SQL,
  MIGRATION_SQL,
  PERFORMANCE_INDEXES_MIGRATION_SQL,
  SANDBOX_MIGRATION_SQL,
  TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL,
  TERRAFORM_MIGRATION_SQL,
} from '../lib/bootstrap/phases/schema.js';
import { createDockerProvider } from '../lib/sandbox/index.js';
import { SANDBOX_DEFAULTS } from '../lib/sandbox/types.js';
import { AgentService } from '../services/agent.service.js';
import { ApiKeyService } from '../services/api-key.service.js';
import { CliMonitorService } from '../services/cli-monitor/index.js';
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
import { TerraformComposeService } from '../services/terraform-compose.service.js';
import { TerraformRegistryService } from '../services/terraform-registry.service.js';
import { startTerraformSyncScheduler } from '../services/terraform-sync-scheduler.js';
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
  serve: (options: {
    port: number;
    fetch: (req: Request) => Response | Promise<Response>;
    idleTimeout?: number;
  }) => void;
};

// Initialize SQLite database using Bun's native SQLite
const DB_PATH = process.env.DB_PATH ?? './data/agentpane.db';
const sqlite = new BunSQLite(DB_PATH);

// Enable WAL mode for better concurrent read performance and crash recovery
sqlite.exec('PRAGMA journal_mode=WAL');
sqlite.exec('PRAGMA busy_timeout=5000');
sqlite.exec('PRAGMA foreign_keys=ON');
log.info('SQLite WAL mode enabled', { data: { dbPath: DB_PATH } });

// Run migrations to ensure schema is up to date
sqlite.exec(MIGRATION_SQL);
log.info('Schema migrations applied');

// Run sandbox migration (may fail if column already exists)
try {
  sqlite.exec(SANDBOX_MIGRATION_SQL);
  log.info('[API Server] Sandbox migration applied');
} catch (error) {
  // Only warn for unexpected errors - duplicate column errors are expected on subsequent runs
  if (!(error instanceof Error && error.message.includes('duplicate column name'))) {
    console.warn(
      '[API Server] Sandbox migration error (unexpected):',
      error instanceof Error ? error.message : String(error)
    );
  }
  // Silently ignore duplicate column errors (expected when migration already applied)
}

// Run template sync interval migration (may fail if columns already exist)
try {
  sqlite.exec(TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL);
  log.info('[API Server] Template sync interval migration applied');
} catch (error) {
  // Only warn for unexpected errors - duplicate column errors are expected on subsequent runs
  if (!(error instanceof Error && error.message.includes('duplicate column name'))) {
    console.warn(
      '[API Server] Template sync interval migration error (unexpected):',
      error instanceof Error ? error.message : String(error)
    );
  }
  // Silently ignore duplicate column errors (expected when migration already applied)
}

// Apply performance indexes (idempotent — uses IF NOT EXISTS)
sqlite.exec(PERFORMANCE_INDEXES_MIGRATION_SQL);
log.info('Performance indexes applied');

// Apply CLI sessions migration (idempotent — uses IF NOT EXISTS)
sqlite.exec(CLI_SESSIONS_MIGRATION_SQL);
log.info('CLI sessions migration applied');

// Add performance_metrics column to cli_sessions (may fail if column already exists)
try {
  sqlite.exec(CLI_SESSIONS_PERF_METRICS_MIGRATION_SQL);
  log.info('CLI sessions performance_metrics migration applied');
} catch (error) {
  if (!(error instanceof Error && error.message.includes('duplicate column name'))) {
    console.warn(
      '[API Server] CLI sessions performance_metrics migration error (unexpected):',
      error instanceof Error ? error.message : String(error)
    );
  }
}

// Apply Terraform tables migration (idempotent — uses IF NOT EXISTS)
sqlite.exec(TERRAFORM_MIGRATION_SQL);
log.info('Terraform migration applied');

const db = drizzle(sqlite, { schema }) as unknown as Database;

// Reset stale agent statuses from previous server runs
// Agents stuck in active states ('starting', 'planning', 'running') cannot be
// legitimately running after a server restart — reset them to 'idle'.
try {
  const staleStatuses = ['starting', 'planning', 'running'] as const;
  const result = db
    .update(agents)
    .set({
      status: 'idle',
      currentTaskId: null,
      currentSessionId: null,
      updatedAt: new Date().toISOString(),
    })
    .where(inArray(agents.status, [...staleStatuses]))
    .run();
  const changes = (result as { changes?: number }).changes ?? 0;
  if (changes > 0) {
    console.log(`[API Server] Reset ${changes} stale agent(s) to idle`);
  }
} catch (error) {
  console.error(
    '[API Server] Failed to reset stale agents:',
    error instanceof Error ? error.message : String(error)
  );
}

// Recover orphaned tasks from previous server runs
// Tasks stuck in 'in_progress' with a non-null agentId cannot be legitimately running
// after a restart — move them back to 'backlog' and clear stale references.
// Uses direct DB update (not taskService.moveColumn) to avoid triggering agent auto-start.
try {
  const result = db
    .update(tasks)
    .set({
      column: 'backlog',
      agentId: null,
      sessionId: null,
      lastAgentStatus: null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(tasks.column, 'in_progress'), isNotNull(tasks.agentId)))
    .run();
  const changes = (result as { changes?: number }).changes ?? 0;
  if (changes > 0) {
    console.log(`[API Server] Recovered ${changes} orphaned task(s) back to backlog`);
  }
} catch (error) {
  console.error(
    '[API Server] Failed to recover orphaned tasks:',
    error instanceof Error ? error.message : String(error)
  );
}

// Clean up orphaned worktrees from tasks where agents are no longer running (Gap 2)
// After a server crash, tasks may still reference worktrees that should be cleaned up.
try {
  const orphanedTasks = db
    .select({ id: tasks.id, worktreeId: tasks.worktreeId })
    .from(tasks)
    .where(isNotNull(tasks.worktreeId))
    .all() as Array<{ id: string; worktreeId: string | null }>;

  // Filter to tasks whose agent is not actively running (after restart, none are)
  const tasksToClean = orphanedTasks.filter(
    (t) => t.worktreeId && (t as { lastAgentStatus?: string }).lastAgentStatus !== 'planning'
  );

  if (tasksToClean.length > 0) {
    console.log(`[API Server] Found ${tasksToClean.length} task(s) with orphaned worktrees`);
    for (const t of tasksToClean) {
      try {
        db.update(tasks)
          .set({
            worktreeId: null,
            branch: null,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, t.id))
          .run();
      } catch (cleanErr) {
        console.error(
          `[API Server] Failed to clear worktree refs for task ${t.id}:`,
          cleanErr instanceof Error ? cleanErr.message : String(cleanErr)
        );
      }
    }
    console.log(`[API Server] Cleared worktree references from ${tasksToClean.length} task(s)`);
    // Note: actual worktree removal happens via WorktreeService after it's initialized below
  }
} catch (error) {
  console.error(
    '[API Server] Failed to clean orphaned worktrees:',
    error instanceof Error ? error.message : String(error)
  );
}

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

// In-memory DurableStreamsServer implementation for local development
// Stores events per stream and supports real-time subscriptions
interface StoredEvent {
  type: string;
  data: unknown;
  offset: number;
  timestamp: number;
}

class InMemoryDurableStreamsServer implements DurableStreamsServer {
  private streams = new Map<string, StoredEvent[]>();
  private subscribers = new Map<
    string,
    Set<(event: { type: string; data: unknown; offset: number }) => void>
  >();

  async createStream(id: string, _schema: unknown): Promise<void> {
    if (!this.streams.has(id)) {
      this.streams.set(id, []);
      this.subscribers.set(id, new Set());
      log.debug(`[InMemoryStreams] Created stream: ${id}`);
    }
  }

  async publish(id: string, type: string, data: unknown): Promise<number> {
    // Auto-create stream if it doesn't exist
    if (!this.streams.has(id)) {
      await this.createStream(id, {});
    }

    const events = this.streams.get(id);
    if (!events) {
      return 0;
    }
    const offset = events.length;
    const event: StoredEvent = {
      type,
      data,
      offset,
      timestamp: Date.now(),
    };
    events.push(event);

    // Notify real-time subscribers
    const subs = this.subscribers.get(id);
    const subscriberCount = subs?.size ?? 0;
    if (subs) {
      for (const callback of subs) {
        try {
          callback({ type, data, offset });
        } catch (err) {
          log.error(`[InMemoryStreams] Subscriber error for ${id}`, { error: err });
        }
      }
    }

    console.log(
      `[InMemoryStreams] Published to ${id}: ${type} (offset: ${offset}, subscribers: ${subscriberCount}, total events: ${events.length})`
    );
    return offset;
  }

  async *subscribe(id: string): AsyncGenerator<{ type: string; data: unknown; offset: number }> {
    // First yield all stored events
    const events = this.streams.get(id) ?? [];
    for (const event of events) {
      yield { type: event.type, data: event.data, offset: event.offset };
    }

    // Then listen for new events using a simple polling approach
    // For real-time, use addRealtimeSubscriber instead
    let lastOffset = events.length - 1;
    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const currentEvents = this.streams.get(id) ?? [];
      for (let i = lastOffset + 1; i < currentEvents.length; i++) {
        const event = currentEvents[i];
        if (event) {
          yield { type: event.type, data: event.data, offset: event.offset };
          lastOffset = i;
        }
      }
    }
  }

  async deleteStream(id: string): Promise<boolean> {
    const existed = this.streams.has(id);
    this.streams.delete(id);
    this.subscribers.delete(id);
    if (existed) {
      log.debug(`[InMemoryStreams] Deleted stream: ${id}`);
    }
    return existed;
  }

  // Get all events for a stream (for SSE endpoint)
  getEvents(id: string): StoredEvent[] {
    const events = this.streams.get(id) ?? [];
    log.debug(`[InMemoryStreams] getEvents called for ${id}: ${events.length} events available`);
    return events;
  }

  // Add a real-time subscriber callback
  addRealtimeSubscriber(
    id: string,
    callback: (event: { type: string; data: unknown; offset: number }) => void
  ): () => void {
    let subs = this.subscribers.get(id);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(id, subs);
    }
    subs.add(callback);
    log.debug(`[InMemoryStreams] Added real-time subscriber for ${id} (total: ${subs.size})`);
    return () => {
      subs.delete(callback);
      console.log(
        `[InMemoryStreams] Removed real-time subscriber for ${id} (remaining: ${subs.size})`
      );
    };
  }
}

// Create in-memory streams server for local development
const inMemoryStreamsServer = new InMemoryDurableStreamsServer();
log.info('[API Server] Using in-memory DurableStreamsServer for local development');

// CLI Monitor service for monitoring Claude Code CLI sessions (with DB persistence)
const cliMonitorService = new CliMonitorService(inMemoryStreamsServer, db);
log.info('[API Server] CLI Monitor receiver ready (waiting for daemon)');

// DurableStreamsService for SSE and container agent events
// Pass db for event persistence to session_events table
const durableStreamsService = new DurableStreamsService(inMemoryStreamsServer, db);

// SessionService for session management (needed for task creation history)
const sessionService = new SessionService(db, inMemoryStreamsServer, {
  baseUrl: 'http://localhost:3001',
});

// TaskCreationService for AI-powered task creation (with session tracking)
const taskCreationService: TaskCreationService = createTaskCreationService(
  db,
  durableStreamsService,
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
  log.info('[API Server] Docker provider initialized');

  // Recover existing containers from previous runs
  const { recovered, removed } = await dockerProvider.recover();
  if (recovered > 0 || removed > 0) {
    console.log(
      `[API Server] Container recovery: ${recovered} recovered, ${removed} stale removed`
    );
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  // Distinguish between expected Docker unavailability and unexpected errors
  const isExpectedError =
    message.includes('ENOENT') || // Docker socket not found
    message.includes('connect ECONNREFUSED') || // Docker not running
    message.includes('permission denied') || // No access to Docker socket
    message.includes('Cannot connect to Docker'); // Docker daemon offline

  if (isExpectedError) {
    log.info('[API Server] Docker not available (expected), container agent service disabled');
  } else {
    log.error(`[API Server] Docker initialization failed with unexpected error: ${message}`);
  }
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
          log.info('[API Server] Default global sandbox created');
        } catch (createErr) {
          log.warn('[API Server] Failed to create default sandbox', { error: createErr });
        }
      } else {
        console.log(
          `[API Server] Default sandbox image '${defaultImage}' not available, skipping default sandbox creation`
        );
      }
    } else {
      log.info('[API Server] Default global sandbox already exists');
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
    containerAgentService = createContainerAgentService(
      db,
      dockerProvider,
      durableStreamsService,
      apiKeyService,
      worktreeService
    );

    // Wire up container agent service to task service
    taskService.setContainerAgentService(containerAgentService);
    log.info('[API Server] ContainerAgentService wired up to TaskService');
  } catch (serviceErr) {
    console.error(
      '[API Server] Failed to create ContainerAgentService:',
      serviceErr instanceof Error ? serviceErr.message : String(serviceErr)
    );
  }
}

// MarketplaceService for plugin marketplace operations
const marketplaceService = new MarketplaceService(db);

// Terraform services
const terraformRegistryService = new TerraformRegistryService(db);
const terraformComposeService = new TerraformComposeService(terraformRegistryService);

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
  dockerProvider,
  cliMonitorService,
  terraformRegistryService,
  terraformComposeService,
});

// Start server
const PORT = 3001;

Bun.serve({
  port: PORT,
  fetch: app.fetch,
  idleTimeout: 0, // Disable idle timeout to prevent Bun from killing long-lived SSE connections
});

console.log(`[API Server] Running on http://localhost:${PORT}`);

// Start the template sync scheduler
const stopTemplateSync = startSyncScheduler(db, templateService);
log.info('[API Server] Template sync scheduler started');

// Start the Terraform sync scheduler
const stopTerraformSync = startTerraformSyncScheduler(db, terraformRegistryService);
log.info('[API Server] Terraform sync scheduler started');

// Graceful shutdown: stop accepting requests, clean up services, close DB
let isShuttingDown = false;

function shutdownServer(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  log.info(`[API Server] Received ${signal}, shutting down gracefully...`);

  // Force-exit safety net after 30 seconds
  const forceExitTimer = setTimeout(() => {
    log.error('[API Server] Graceful shutdown timed out after 30s, forcing exit');
    process.exit(1);
  }, 30_000);
  forceExitTimer.unref();

  // Stop running agents
  if (containerAgentService) {
    const runningAgents = containerAgentService.getRunningAgents();
    for (const agent of runningAgents) {
      containerAgentService.stopAgent(agent.taskId).catch((stopErr) => {
        log.warn('[API Server] Failed to stop agent during shutdown', {
          data: { taskId: agent.taskId, error: String(stopErr) },
        });
      });
    }
    containerAgentService.dispose();
  }

  // Stop schedulers
  stopTemplateSync();
  stopTerraformSync();

  // Clean up services
  cliMonitorService.destroy();

  // Close database
  try {
    sqlite.close();
    log.info('[API Server] Database closed');
  } catch (dbErr) {
    log.warn('[API Server] Failed to close database', { error: dbErr });
  }

  log.info('[API Server] Shutdown complete');
  process.exit(0);
}

process.on('SIGINT', () => shutdownServer('SIGINT'));
process.on('SIGTERM', () => shutdownServer('SIGTERM'));
