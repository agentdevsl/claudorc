import type { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema/index.js';
import { createError } from '@/lib/errors/base';
import { err, ok, type Result } from '@/lib/utils/result';
import { AgentService } from '@/services/agent.service';
import { ProjectService } from '@/services/project.service';
import { type DurableStreamsServer, SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { type CommandRunner, WorktreeService } from '@/services/worktree.service';
import type { Database } from '@/types/database';

export type Services = {
  db: Database;
  worktreeService: WorktreeService;
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  agentService: AgentService;
};

export type ServicesResult = Result<Services, ReturnType<typeof createError>>;

// TODO: Implement actual command runner using Bun.$ for git worktree operations
// This stub is temporary - all worktree operations will silently do nothing
const createRunner = (): CommandRunner => {
  if (process.env.NODE_ENV === 'production') {
    console.warn('[Services] Using stub CommandRunner - worktree operations will not function');
  }
  return {
    exec: async (_command: string, _cwd: string) => ({ stdout: '', stderr: '' }),
  };
};

export function createServices(context: { db?: PGlite; streams?: unknown }): ServicesResult {
  if (!context.db) {
    console.error('[Services] Database not available during service initialization');
    return err(createError('SERVICES_DB_MISSING', 'Database not available', 500));
  }

  const database: Database = drizzle(context.db, { schema });
  const runner = createRunner();
  const worktreeService = new WorktreeService(database, runner);
  const projectService = new ProjectService(database, worktreeService, runner);
  const taskService = new TaskService(database, worktreeService);

  if (!context.streams) {
    console.error('[Services] Streams not configured during service initialization');
    return err(createError('SERVICES_STREAMS_MISSING', 'Streams not configured', 500));
  }

  const streams = context.streams as DurableStreamsServer;
  const sessionService = new SessionService(database, streams, {
    baseUrl: process.env.APP_URL ?? 'http://localhost:5173',
  });
  const agentService = new AgentService(database, worktreeService, taskService, sessionService);

  return ok({
    db: database,
    worktreeService,
    projectService,
    taskService,
    sessionService,
    agentService,
  });
}
