import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq } from 'drizzle-orm';
import { agentRuns } from '../../db/schema/agent-runs.js';
import { agents } from '../../db/schema/agents.js';
import { projects } from '../../db/schema/projects.js';
import { sessions } from '../../db/schema/sessions.js';
import { tasks } from '../../db/schema/tasks.js';
import { worktrees } from '../../db/schema/worktrees.js';
import { createAgentHooks } from '../../lib/agents/hooks/index.js';
import { handleAgentError } from '../../lib/agents/recovery.js';
import { runAgentPlanning } from '../../lib/agents/stream-handler.js';
import type { AgentError } from '../../lib/errors/agent-errors.js';
import { AgentErrors } from '../../lib/errors/agent-errors.js';
import type { ConcurrencyError } from '../../lib/errors/concurrency-errors.js';
import { ConcurrencyErrors } from '../../lib/errors/concurrency-errors.js';
import { resolveModel } from '../../lib/utils/resolve-model.js';
import type { Result } from '../../lib/utils/result.js';
import { err, ok } from '../../lib/utils/result.js';
import type { Database } from '../../types/database.js';
import { getGlobalDefaultModel } from '../settings.service.js';
import type {
  AgentRunResult,
  AgentStartResult,
  PostToolUseHook,
  PreToolUseHook,
  SessionServiceInterface,
  TaskService,
  WorktreeService,
} from './types.js';

/**
 * Shared map of running agents with their AbortControllers.
 * This is module-level to allow proper cleanup across service instances.
 */
const runningAgents = new Map<string, AbortController>();

/**
 * AgentExecutionService handles agent lifecycle and execution.
 *
 * Responsibilities:
 * - Start agent execution with task assignment
 * - Stop running agents
 * - Pause and resume agents
 * - Manage AbortController lifecycle
 * - Handle execution results and errors
 * - Check project availability for new agents
 */
export class AgentExecutionService {
  private preToolHooks = new Map<string, PreToolUseHook[]>();
  private postToolHooks = new Map<string, PostToolUseHook[]>();

  constructor(
    private db: Database,
    private worktreeService: WorktreeService,
    private taskService: TaskService,
    private sessionService: SessionServiceInterface
  ) {}

  /**
   * Start an agent with an optional specific task.
   * If no task is specified, picks the next available task from the backlog.
   */
  async start(
    agentId: string,
    taskId?: string
  ): Promise<Result<AgentStartResult, AgentError | ConcurrencyError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    if (agent.status !== 'idle') {
      return err(AgentErrors.ALREADY_RUNNING(agent.currentTaskId ?? undefined));
    }

    let task = taskId
      ? await this.db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
        })
      : null;

    if (!task) {
      task = await this.db.query.tasks.findFirst({
        where: and(eq(tasks.projectId, agent.projectId), eq(tasks.column, 'backlog')),
        orderBy: desc(tasks.createdAt),
      });
    }

    if (!task) {
      return err(AgentErrors.NO_AVAILABLE_TASK);
    }

    if (task.column !== 'backlog') {
      return err(AgentErrors.NO_AVAILABLE_TASK);
    }

    // Check concurrency BEFORE modifying task state to avoid race condition
    const availability = await this.checkAvailability(agent.projectId);
    if (!availability.ok || !availability.value) {
      const runningResult = await this.getRunningCount(agent.projectId);
      const runningCount = runningResult.ok ? runningResult.value : 0;
      const project = await this.db.query.projects.findFirst({
        where: eq(projects.id, agent.projectId),
      });
      return err(ConcurrencyErrors.LIMIT_EXCEEDED(runningCount, project?.maxConcurrentAgents ?? 1));
    }

    await this.taskService.moveColumn(task.id, 'in_progress');

    const worktree = await this.worktreeService.create({
      projectId: agent.projectId,
      agentId: agent.id,
      taskId: task.id,
      taskTitle: task.title,
    });
    if (!worktree.ok) {
      return worktree;
    }

    const session = await this.sessionService.create({
      projectId: agent.projectId,
      taskId: task.id,
      agentId: agent.id,
      title: task.title,
    });

    if (!session.ok) {
      return err(AgentErrors.EXECUTION_ERROR('Failed to create session'));
    }

    await this.db
      .update(tasks)
      .set({
        column: 'in_progress',
        agentId,
        sessionId: session.value.id,
        worktreeId: worktree.value.id,
        branch: worktree.value.branch,
        startedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, task.id));

    await this.db
      .update(agents)
      .set({
        status: 'starting',
        currentTaskId: task.id,
        currentSessionId: session.value.id,
        currentTurn: 0,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));

    await this.sessionService.publish(session.value.id, {
      id: createId(),
      type: 'state:update',
      timestamp: Date.now(),
      data: { status: 'starting', agentId, taskId: task.id },
    });

    const [agentRun] = await this.db
      .insert(agentRuns)
      .values({
        agentId,
        taskId: task.id,
        projectId: agent.projectId,
        sessionId: session.value.id,
        status: 'running',
      })
      .returning();

    const controller = new AbortController();
    runningAgents.set(agentId, controller);

    // Start in planning status - agent will explore and create a plan first
    await this.db.update(agents).set({ status: 'planning' }).where(eq(agents.id, agentId));

    // Get project for model configuration
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, agent.projectId),
    });

    // Resolve model using cascade priority:
    // Task.modelOverride → Agent.config.model → Project.config.model → Global setting → Default
    const taskModelOverride = (task as typeof task & { modelOverride?: string | null })
      .modelOverride;
    const projectConfig = project?.config as { model?: string } | null;

    const globalDefault = await getGlobalDefaultModel(this.db);

    const resolvedModel = resolveModel({
      taskModelOverride: taskModelOverride,
      agentModel: agent.config?.model,
      projectModel: projectConfig?.model,
      globalDefault,
    });

    // Build task prompt
    const taskPrompt = `Work on the following task:\n\nTitle: ${task.title}\n\nDescription: ${task.description ?? 'No description provided'}\n\nThe task is in the worktree at: ${worktree.value.path}`;

    // Create agent hooks for streaming and audit
    const hooks = createAgentHooks({
      agentId,
      sessionId: session.value.id,
      agentRunId: agentRun?.id ?? createId(),
      taskId: task.id,
      projectId: agent.projectId,
      allowedTools: agent.config?.allowedTools ?? [],
      db: this.db,
      sessionService: this.sessionService,
    });

    // Start agent execution asynchronously (fire-and-forget with error handling)
    // The agent runs in the background and updates state through events
    this.executeAgentAsync(
      agentId,
      session.value.id,
      taskPrompt,
      {
        allowedTools: agent.config?.allowedTools ?? [],
        maxTurns: agent.config?.maxTurns ?? 50,
        model: resolvedModel,
        cwd: worktree.value.path,
        hooks,
      },
      agentRun?.id ?? createId(),
      task.id
    );

    const updatedAgent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    const updatedTask = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, task.id),
    });

    const updatedSession = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, session.value.id),
    });

    const updatedWorktree = await this.db.query.worktrees.findFirst({
      where: eq(worktrees.id, worktree.value.id),
    });

    if (!updatedAgent || !updatedTask || !updatedSession || !updatedWorktree) {
      return err(AgentErrors.EXECUTION_ERROR('Missing updated resources after start'));
    }

    return ok({
      agent: updatedAgent,
      task: updatedTask,
      session: updatedSession,
      worktree: updatedWorktree,
    });
  }

  /**
   * Execute agent asynchronously with streaming.
   * Updates agent status based on execution result.
   */
  private async executeAgentAsync(
    agentId: string,
    sessionId: string,
    prompt: string,
    options: {
      allowedTools: string[];
      maxTurns: number;
      model: string;
      cwd: string;
      hooks: ReturnType<typeof createAgentHooks>;
    },
    runId: string,
    taskId: string
  ): Promise<void> {
    try {
      const result = await runAgentPlanning({
        agentId,
        sessionId,
        prompt,
        allowedTools: options.allowedTools,
        maxTurns: options.maxTurns,
        model: options.model,
        cwd: options.cwd,
        hooks: options.hooks,
        sessionService: this.sessionService,
      });

      // Update agent run with result
      // Map SDK statuses to database enum values:
      // - 'turn_limit' (SDK) -> 'paused' (DB) - agent hit iteration limit
      // - 'planning' (SDK) -> 'running' (DB) - agent is in planning phase awaiting approval
      // Note: DB schema uses 'running' for planning since 'planning' isn't a DB enum value
      let dbStatus: 'completed' | 'error' | 'paused' | 'running';
      switch (result.status) {
        case 'turn_limit':
          dbStatus = 'paused';
          break;
        case 'planning':
          dbStatus = 'running';
          break;
        case 'completed':
        case 'error':
        case 'paused':
          dbStatus = result.status;
          break;
        default: {
          // Exhaustive check - TypeScript will error if a new status is added
          const _exhaustiveCheck: never = result.status;
          void _exhaustiveCheck;
          console.error(
            `[AgentExecutionService] Unknown agent status: ${result.status}, defaulting to error`
          );
          dbStatus = 'error';
        }
      }
      await this.db
        .update(agentRuns)
        .set({
          status: dbStatus,
          completedAt: result.status === 'planning' ? null : new Date().toISOString(),
          turnsUsed: result.turnCount,
          errorMessage: result.error,
        })
        .where(eq(agentRuns.id, runId));

      // Update agent status based on result
      if (result.status === 'planning') {
        // Planning phase completed - agent stays in 'planning' status
        // Task stays in 'in_progress' - user needs to approve the plan
        await this.db
          .update(agents)
          .set({
            status: 'planning',
            currentTurn: result.turnCount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agents.id, agentId));

        // Store the plan and options on the task
        await this.db
          .update(tasks)
          .set({
            plan: result.plan,
            planOptions: result.planOptions,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));

        console.log(
          `[AgentExecutionService] Agent ${agentId} planning complete, awaiting approval`
        );
      } else if (result.status === 'completed') {
        await this.db
          .update(agents)
          .set({
            status: 'idle',
            currentTaskId: null,
            currentSessionId: null,
            currentTurn: result.turnCount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agents.id, agentId));

        // Move task to waiting_approval
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
      } else if (result.status === 'turn_limit' || result.status === 'paused') {
        await this.db
          .update(agents)
          .set({
            status: 'paused',
            currentTurn: result.turnCount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agents.id, agentId));

        // Move task to waiting_approval for review
        await this.db
          .update(tasks)
          .set({
            column: 'waiting_approval',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, taskId));
      } else if (result.status === 'error') {
        await this.db
          .update(agents)
          .set({
            status: 'error',
            currentTurn: result.turnCount,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(agents.id, agentId));
      }

      // Remove from running agents
      runningAgents.delete(agentId);
    } catch (error) {
      console.error(`[AgentExecutionService] Agent ${agentId} execution failed:`, error);

      const errorMessage = error instanceof Error ? error.message : String(error);
      const recovery = handleAgentError(error instanceof Error ? error : new Error(errorMessage), {
        agentId,
        taskId,
        maxTurns: options.maxTurns,
        currentTurn: 0,
      });

      // Update run with error
      await this.db
        .update(agentRuns)
        .set({
          status: 'error',
          completedAt: new Date().toISOString(),
          errorMessage: errorMessage,
        })
        .where(eq(agentRuns.id, runId));

      // Update agent status
      await this.db
        .update(agents)
        .set({
          status: recovery.action === 'pause' ? 'paused' : 'error',
          updatedAt: new Date().toISOString(),
        })
        .where(eq(agents.id, agentId));

      // Publish error event
      await this.sessionService.publish(sessionId, {
        id: createId(),
        type: 'agent:error',
        timestamp: Date.now(),
        data: { agentId, error: errorMessage, recovery: recovery.action },
      });

      runningAgents.delete(agentId);
    }
  }

  /**
   * Stop a running agent by aborting its execution.
   */
  async stop(agentId: string): Promise<Result<void, AgentError>> {
    const controller = runningAgents.get(agentId);
    if (!controller) {
      return err(AgentErrors.NOT_RUNNING);
    }

    controller.abort();
    runningAgents.delete(agentId);

    await this.db
      .update(agents)
      .set({
        status: 'idle',
        currentTaskId: null,
        currentSessionId: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(agents.id, agentId));

    return ok(undefined);
  }

  /**
   * Pause a running agent.
   */
  async pause(agentId: string): Promise<Result<void, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    await this.db
      .update(agents)
      .set({ status: 'paused', updatedAt: new Date().toISOString() })
      .where(eq(agents.id, agentId));

    return ok(undefined);
  }

  /**
   * Resume a paused agent with optional feedback.
   */
  async resume(agentId: string, feedback?: string): Promise<Result<AgentRunResult, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    await this.db
      .update(agents)
      .set({ status: 'running', updatedAt: new Date().toISOString() })
      .where(eq(agents.id, agentId));

    if (agent.currentSessionId) {
      await this.sessionService.publish(agent.currentSessionId, {
        id: createId(),
        type: 'approval:rejected',
        timestamp: Date.now(),
        data: { feedback },
      });
    }

    return ok({
      runId: createId(),
      status: 'paused',
      turnCount: agent.currentTurn ?? 0,
    });
  }

  /**
   * Check if a project has availability for a new running agent.
   */
  async checkAvailability(projectId: string): Promise<Result<boolean, never>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return ok(false);
    }

    const runningResult = await this.getRunningCount(projectId);
    const runningCount = runningResult.ok ? runningResult.value : 0;
    return ok(runningCount < (project.maxConcurrentAgents ?? 3));
  }

  /**
   * Get the count of running agents for a specific project.
   */
  async getRunningCount(projectId: string): Promise<Result<number, never>> {
    const running = await this.db.query.agents.findMany({
      where: and(eq(agents.projectId, projectId), eq(agents.status, 'running')),
    });

    return ok(running.length);
  }

  /**
   * Register a pre-tool use hook for an agent.
   */
  registerPreToolUseHook(agentId: string, hook: PreToolUseHook): void {
    const hooks = this.preToolHooks.get(agentId) ?? [];
    hooks.push(hook);
    this.preToolHooks.set(agentId, hooks);
  }

  /**
   * Register a post-tool use hook for an agent.
   */
  registerPostToolUseHook(agentId: string, hook: PostToolUseHook): void {
    const hooks = this.postToolHooks.get(agentId) ?? [];
    hooks.push(hook);
    this.postToolHooks.set(agentId, hooks);
  }

  /**
   * Check if an agent is currently running.
   */
  isRunning(agentId: string): boolean {
    return runningAgents.has(agentId);
  }
}
