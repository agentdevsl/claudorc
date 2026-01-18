import type { AppError, createError } from '@/lib/errors/base';
import { ok, type Result } from '@/lib/utils/result';
import { AgentService } from '@/services/agent.service';
import { ProjectService } from '@/services/project.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';
import type { Database } from '@/types/database';
import type { DurableStreamsServer } from '@/services/session.service';

/**
 * Application services configuration.
 * Provides access to all business logic services.
 */
export type Services = {
  agentService: AgentService;
  projectService: ProjectService;
  taskService: TaskService;
  sessionService: SessionService;
  worktreeService: WorktreeService;
};

export type ServicesResult = Result<Services, ReturnType<typeof createError>>;

/**
 * Create application services.
 * Instantiates all service classes with their dependencies.
 */
export function createServices(context: {
  db: Database;
  streams: DurableStreamsServer;
}): ServicesResult {
  try {
    // Create a minimal command runner for browser/test environments
    const runner = {
      exec: async (command: string, cwd: string) => {
        console.log(`[Services] exec: ${command} in ${cwd}`);
        return { stdout: '', stderr: '' };
      },
    };

    const worktreeService = new WorktreeService(context.db, runner);
    const taskService = new TaskService(context.db, {
      getDiff: (worktreeId: string) => worktreeService.getDiff(worktreeId),
      merge: (worktreeId: string, targetBranch?: string) =>
        worktreeService.merge(worktreeId, targetBranch),
      remove: (worktreeId: string) => worktreeService.remove(worktreeId),
    });

    const sessionService = new SessionService(context.db, context.streams, {
      baseUrl: 'http://localhost:3000',
    });

    const projectService = new ProjectService(context.db, { prune: (projectId: string) => worktreeService.prune(projectId) }, runner);

    const agentService = new AgentService(context.db, { create: (input) => worktreeService.create(input) }, { moveColumn: (id, column) => taskService.moveColumn(id, column) }, sessionService);

    console.log('[Services] All services initialized successfully');

    return ok({
      agentService,
      projectService,
      taskService,
      sessionService,
      worktreeService,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Services] Failed to create services:', message);
    return {
      ok: false,
      error: {
        code: 'SERVICE_INITIALIZATION_FAILED',
        message,
        status: 500,
      } as AppError,
    };
  }
}
