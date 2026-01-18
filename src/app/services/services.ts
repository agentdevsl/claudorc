import type Database from 'better-sqlite3';
import type { createError } from '@/lib/errors/base';
import { err, ok, type Result } from '@/lib/utils/result';
import { AgentService } from '@/services/agent.service';
import { GitHubTokenService } from '@/services/github-token.service';
import { ProjectService } from '@/services/project.service';
import type { DurableStreamsServer } from '@/services/session.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';
import type { Database as DrizzleDatabase } from '@/types/database';
import { createRuntimeContext } from './runtime';

// Mock streams for client-side only mode
const createMockStreams = (): DurableStreamsServer => ({
  createStream: async () => undefined,
  publish: async () => undefined,
  subscribe: async function* () {
    yield { type: 'connected', data: {} };
  },
});

export type Services = {
  db: DrizzleDatabase;
  worktreeService: WorktreeService;
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  agentService: AgentService;
  githubTokenService: GitHubTokenService;
};

export type ServicesResult = Result<Services, ReturnType<typeof createError>>;

export function createServices(context: {
  db?: Database.Database;
  streams?: unknown;
}): ServicesResult {
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

  // Use mock streams if real streams aren't available (client-side only mode)
  const streams = runtime.value.streams ?? createMockStreams();
  if (!runtime.value.streams) {
    console.warn('[Services] Using mock streams - real-time features disabled');
  }

  const sessionService = new SessionService(runtime.value.db, streams, {
    baseUrl:
      (typeof process !== 'undefined' ? process.env?.APP_URL : undefined) ??
      'http://localhost:5173',
  });
  const agentService = new AgentService(
    runtime.value.db,
    worktreeService,
    taskService,
    sessionService
  );

  const githubTokenService = new GitHubTokenService(runtime.value.db);

  return ok({
    db: runtime.value.db,
    worktreeService,
    projectService,
    taskService,
    sessionService,
    agentService,
    githubTokenService,
  });
}
