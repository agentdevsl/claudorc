import { createId } from "@paralleldrive/cuid2";
import { and, desc, eq } from "drizzle-orm";
import { agentRuns } from "../db/schema/agent-runs.js";
import type { Agent, AgentConfig, NewAgent } from "../db/schema/agents.js";
import { agents } from "../db/schema/agents.js";
import { projects } from "../db/schema/projects.js";
import type { Session } from "../db/schema/sessions.js";
import { sessions } from "../db/schema/sessions.js";
import type { Task } from "../db/schema/tasks.js";
import { tasks } from "../db/schema/tasks.js";
import type { Worktree } from "../db/schema/worktrees.js";
import { worktrees } from "../db/schema/worktrees.js";
import type { AgentError } from "../lib/errors/agent-errors.js";
import { AgentErrors } from "../lib/errors/agent-errors.js";
import type { ConcurrencyError } from "../lib/errors/concurrency-errors.js";
import { ConcurrencyErrors } from "../lib/errors/concurrency-errors.js";
import type { ValidationError } from "../lib/errors/validation-errors.js";
import { ValidationErrors } from "../lib/errors/validation-errors.js";
import type { Result } from "../lib/utils/result.js";
import { err, ok } from "../lib/utils/result.js";
import type { Database } from "../types/database.js";
import type { SessionEvent, SessionWithPresence } from "./session.service.js";

export type AgentExecutionContext = {
  agentId: string;
  taskId: string;
  projectId: string;
  sessionId: string;
  cwd: string;
  allowedTools: string[];
  maxTurns: number;
  env: Record<string, string>;
};

export type AgentRunResult = {
  runId: string;
  status: "completed" | "error" | "turn_limit" | "paused";
  turnCount: number;
  result?: string;
  error?: string;
  diff?: string;
};

export type QueuePosition = {
  taskId: string;
  position: number;
  estimatedWaitMinutes: number;
};

export type PreToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
}) => Promise<{ deny?: boolean; reason?: string }>;

export type PostToolUseHook = (input: {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_response: unknown;
}) => Promise<void>;

type WorktreeService = {
  create: (input: {
    projectId: string;
    taskId: string;
  }) => Promise<Result<Worktree, AgentError>>;
};

type TaskService = {
  moveColumn: (
    taskId: string,
    column: "in_progress" | "waiting_approval",
  ) => Promise<Result<unknown, AgentError>>;
};

type SessionServiceInterface = {
  create: (input: {
    projectId: string;
    taskId?: string;
    agentId?: string;
    title?: string;
  }) => Promise<Result<SessionWithPresence, unknown>>;
  publish: (
    sessionId: string,
    event: SessionEvent,
  ) => Promise<Result<void, unknown>>;
};

const runningAgents = new Map<string, AbortController>();

export class AgentService {
  private preToolHooks = new Map<string, PreToolUseHook[]>();
  private postToolHooks = new Map<string, PostToolUseHook[]>();

  constructor(
    private db: Database,
    private worktreeService: WorktreeService,
    private taskService: TaskService,
    private sessionService: SessionServiceInterface,
  ) {}

  async create(input: NewAgent): Promise<Result<Agent, ValidationError>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return err(ValidationErrors.INVALID_ID("projectId"));
    }

    const config: AgentConfig = {
      allowedTools:
        input.config?.allowedTools ?? project.config?.allowedTools ?? [],
      maxTurns: input.config?.maxTurns ?? project.config?.maxTurns ?? 50,
      model: input.config?.model ?? project.config?.model,
      systemPrompt: input.config?.systemPrompt ?? project.config?.systemPrompt,
      temperature: input.config?.temperature ?? project.config?.temperature,
    };

    const [agent] = await this.db
      .insert(agents)
      .values({
        ...input,
        config,
      })
      .returning();

    return ok(agent as Agent);
  }

  async getById(id: string): Promise<Result<Agent, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    return ok(agent);
  }

  async list(projectId: string): Promise<Result<Agent[], never>> {
    const items = await this.db.query.agents.findMany({
      where: eq(agents.projectId, projectId),
      orderBy: [desc(agents.updatedAt)],
    });

    return ok(items);
  }

  async listAll(): Promise<Result<Agent[], never>> {
    const items = await this.db.query.agents.findMany({
      orderBy: [desc(agents.updatedAt)],
    });

    return ok(items);
  }

  async getRunningCountAll(): Promise<Result<number, never>> {
    const running = await this.db.query.agents.findMany({
      where: eq(agents.status, "running"),
    });

    return ok(running.length);
  }

  async update(
    id: string,
    input: Partial<AgentConfig>,
  ): Promise<Result<Agent, AgentError | ValidationError>> {
    const existing = await this.getById(id);
    if (!existing.ok) {
      return existing;
    }

    if (existing.value.status === "running") {
      if (input.allowedTools || input.model) {
        return err(
          AgentErrors.ALREADY_RUNNING(
            existing.value.currentTaskId ?? undefined,
          ),
        );
      }
    }

    const mergedConfig: AgentConfig = {
      allowedTools:
        input.allowedTools ?? existing.value.config?.allowedTools ?? [],
      maxTurns: input.maxTurns ?? existing.value.config?.maxTurns ?? 50,
      model: input.model ?? existing.value.config?.model,
      systemPrompt: input.systemPrompt ?? existing.value.config?.systemPrompt,
      temperature: input.temperature ?? existing.value.config?.temperature,
    };

    const [updated] = await this.db
      .update(agents)
      .set({ config: mergedConfig, updatedAt: new Date() })
      .where(eq(agents.id, id))
      .returning();

    if (!updated) {
      return err(AgentErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, id),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    await this.db.delete(agents).where(eq(agents.id, id));
    return ok(undefined);
  }

  async start(
    agentId: string,
    taskId?: string,
  ): Promise<
    Result<
      { agent: Agent; task: Task; session: Session; worktree: Worktree },
      AgentError | ConcurrencyError
    >
  > {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    if (agent.status !== "idle") {
      return err(AgentErrors.ALREADY_RUNNING(agent.currentTaskId ?? undefined));
    }

    let task = taskId
      ? await this.db.query.tasks.findFirst({
          where: eq(tasks.id, taskId),
        })
      : null;

    if (!task) {
      task = await this.db.query.tasks.findFirst({
        where: and(
          eq(tasks.projectId, agent.projectId),
          eq(tasks.column, "backlog"),
        ),
        orderBy: desc(tasks.createdAt),
      });
    }

    if (!task) {
      return err(AgentErrors.NO_AVAILABLE_TASK);
    }

    if (task.column !== "backlog") {
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
      return err(
        ConcurrencyErrors.LIMIT_EXCEEDED(
          runningCount,
          project?.maxConcurrentAgents ?? 1,
        ),
      );
    }

    await this.taskService.moveColumn(task.id, "in_progress");

    const worktree = await this.worktreeService.create({
      projectId: agent.projectId,
      taskId: task.id,
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
      return err(AgentErrors.EXECUTION_ERROR("Failed to create session"));
    }

    await this.db
      .update(tasks)
      .set({
        column: "in_progress",
        agentId,
        sessionId: session.value.id,
        worktreeId: worktree.value.id,
        branch: `agent/${agentId}/${task.id}`,
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(tasks.id, task.id));

    await this.db
      .update(agents)
      .set({
        status: "starting",
        currentTaskId: task.id,
        currentSessionId: session.value.id,
        currentTurn: 0,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    await this.sessionService.publish(session.value.id, {
      id: createId(),
      type: "state:update",
      timestamp: Date.now(),
      data: { status: "starting", agentId, taskId: task.id },
    });

    const [agentRun] = await this.db
      .insert(agentRuns)
      .values({
        agentId,
        taskId: task.id,
        projectId: agent.projectId,
        sessionId: session.value.id,
        status: "running",
      })
      .returning();

    const controller = new AbortController();
    runningAgents.set(agentId, controller);

    await this.db
      .update(agents)
      .set({ status: "running" })
      .where(eq(agents.id, agentId));

    if (agentRun) {
      await this.db
        .update(agentRuns)
        .set({ status: "completed", completedAt: new Date(), turnsUsed: 0 })
        .where(eq(agentRuns.id, agentRun.id));
    }

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
      return err(
        AgentErrors.EXECUTION_ERROR("Missing updated resources after start"),
      );
    }

    return ok({
      agent: updatedAgent,
      task: updatedTask,
      session: updatedSession,
      worktree: updatedWorktree,
    });
  }

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
        status: "idle",
        currentTaskId: null,
        currentSessionId: null,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, agentId));

    return ok(undefined);
  }

  async pause(agentId: string): Promise<Result<void, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    await this.db
      .update(agents)
      .set({ status: "paused", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    return ok(undefined);
  }

  async resume(
    agentId: string,
    feedback?: string,
  ): Promise<Result<AgentRunResult, AgentError>> {
    const agent = await this.db.query.agents.findFirst({
      where: eq(agents.id, agentId),
    });

    if (!agent) {
      return err(AgentErrors.NOT_FOUND);
    }

    await this.db
      .update(agents)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(agents.id, agentId));

    if (agent.currentSessionId) {
      await this.sessionService.publish(agent.currentSessionId, {
        id: createId(),
        type: "approval:rejected",
        timestamp: Date.now(),
        data: { feedback },
      });
    }

    return ok({
      runId: createId(),
      status: "paused",
      turnCount: agent.currentTurn ?? 0,
    });
  }

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

  async queueTask(
    _projectId: string,
    _taskId: string,
  ): Promise<Result<QueuePosition, ConcurrencyError>> {
    return err(ConcurrencyErrors.QUEUE_FULL(0, 0));
  }

  async getRunningCount(projectId: string): Promise<Result<number, never>> {
    const running = await this.db.query.agents.findMany({
      where: and(eq(agents.projectId, projectId), eq(agents.status, "running")),
    });

    return ok(running.length);
  }

  async getQueuedTasks(): Promise<Result<QueuePosition[], never>> {
    return ok([]);
  }

  registerPreToolUseHook(agentId: string, hook: PreToolUseHook): void {
    const hooks = this.preToolHooks.get(agentId) ?? [];
    hooks.push(hook);
    this.preToolHooks.set(agentId, hooks);
  }

  registerPostToolUseHook(agentId: string, hook: PostToolUseHook): void {
    const hooks = this.postToolHooks.get(agentId) ?? [];
    hooks.push(hook);
    this.postToolHooks.set(agentId, hooks);
  }
}
