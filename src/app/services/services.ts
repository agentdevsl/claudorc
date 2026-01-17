import type { PGlite } from '@electric-sql/pglite';
import { createError } from '@/lib/errors/base';
import { err, ok, type Result } from '@/lib/utils/result';
import { AgentService } from '@/services/agent.service';
import { ProjectService } from '@/services/project.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';
import type { Database } from '@/types/database';
import { createRuntimeContext } from './runtime';

export type Services = {
  db: Database;
  worktreeService: WorktreeService;
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  agentService: AgentService;
};

export type ServicesResult = Result<Services, ReturnType<typeof createError>>;

export function createServices(context: { db?: PGlite; streams?: unknown }): ServicesResult {
  const runtime = createRuntimeContext({
    db: context.db,
    streams: context.streams,
  });
  if (!runtime.ok) {
    return err(runtime.error);
  }

  const worktreeService = new WorktreeService(runtime.value.db, runtime.value.runner);
  const projectService = new ProjectService(
    runtime.value.db,
    worktreeService,
    runtime.value.runner
  );
  const taskService = new TaskService(runtime.value.db, worktreeService);

  if (!runtime.value.streams) {
    console.error('[Services] Streams not configured during service initialization');
    return err(createError('SERVICES_STREAMS_MISSING', 'Streams not configured', 500));
  }

  const sessionService = new SessionService(runtime.value.db, runtime.value.streams, {
    baseUrl: process.env.APP_URL ?? 'http://localhost:5173',
  });
  const agentService = new AgentService(
    runtime.value.db,
    worktreeService,
    taskService,
    sessionService
  );

  return ok({
    db: runtime.value.db,
    worktreeService,
    projectService,
    taskService,
    sessionService,
    agentService,
  });
}
