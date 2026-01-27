import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq } from 'drizzle-orm';
import { projects } from '../db/schema/projects.js';
import type { Task, TaskColumn } from '../db/schema/tasks.js';
import { tasks } from '../db/schema/tasks.js';
import { ProjectErrors } from '../lib/errors/project-errors.js';
import type { TaskError } from '../lib/errors/task-errors.js';
import { TaskErrors } from '../lib/errors/task-errors.js';
import { ValidationErrors } from '../lib/errors/validation-errors.js';
import type { ProjectSandboxConfig } from '../lib/sandbox/types.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';
import type { StartAgentInput } from './container-agent.service.js';
import { canTransition } from './task-transitions.js';
import type { GitDiff } from './worktree.service.js';

export type CreateTaskInput = {
  projectId: string;
  title: string;
  description?: string;
  labels?: string[];
  priority?: 'high' | 'medium' | 'low';
};

export type UpdateTaskInput = {
  title?: string;
  description?: string;
  labels?: string[];
  priority?: 'high' | 'medium' | 'low';
  /** Model override for this task (short ID like 'claude-opus-4') */
  modelOverride?: string | null;
};

export type ListTasksOptions = {
  column?: TaskColumn;
  agentId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'position' | 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
};

export type ApproveInput = {
  approvedBy?: string;
  createMergeCommit?: boolean;
};

export type RejectInput = {
  reason: string;
};

export type DiffResult = {
  taskId: string;
  branch: string;
  baseBranch: string;
  files: GitDiff['files'];
  summary: GitDiff['stats'];
};

/**
 * Optional container agent service for triggering agent execution on task move.
 */
export interface ContainerAgentTrigger {
  startAgent: (input: StartAgentInput) => Promise<Result<void, unknown>>;
  isAgentRunning: (taskId: string) => boolean;
}

export class TaskService {
  private containerAgentService?: ContainerAgentTrigger;

  constructor(
    private db: Database,
    private worktreeService: {
      getDiff: (worktreeId: string) => Promise<Result<GitDiff, TaskError>>;
      merge: (worktreeId: string, targetBranch?: string) => Promise<Result<void, TaskError>>;
      remove: (worktreeId: string) => Promise<Result<void, TaskError>>;
    }
  ) {}

  /**
   * Set the container agent service for automatic agent triggering.
   * This is optional - if not set, tasks won't auto-trigger container agents.
   */
  setContainerAgentService(service: ContainerAgentTrigger): void {
    this.containerAgentService = service;
  }

  async create(input: CreateTaskInput): Promise<Result<Task, TaskError>> {
    const { projectId, title, description, labels = [], priority = 'medium' } = input;

    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    const lastTask = await this.db.query.tasks.findFirst({
      where: and(eq(tasks.projectId, projectId), eq(tasks.column, 'backlog')),
      orderBy: desc(tasks.position),
    });

    const position = (lastTask?.position ?? -1) + 1;

    const [task] = await this.db
      .insert(tasks)
      .values({
        projectId,
        title,
        description,
        labels,
        priority,
        column: 'backlog',
        position,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .returning();

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(task);
  }

  async getById(id: string): Promise<Result<Task, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(task);
  }

  async list(projectId: string, options?: ListTasksOptions): Promise<Result<Task[], TaskError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'position';
    const direction = options?.orderDirection ?? 'asc';

    const orderColumn =
      orderBy === 'createdAt'
        ? tasks.createdAt
        : orderBy === 'updatedAt'
          ? tasks.updatedAt
          : tasks.position;

    const filters = [eq(tasks.projectId, projectId)];
    if (options?.column) {
      filters.push(eq(tasks.column, options.column));
    }
    if (options?.agentId) {
      filters.push(eq(tasks.agentId, options.agentId));
    }

    const items = await this.db.query.tasks.findMany({
      where: filters.length > 1 ? and(...filters) : filters[0],
      orderBy: (direction === 'asc' ? [orderColumn] : [desc(orderColumn)]) as never,
      limit,
      offset,
    });

    return ok(items);
  }

  async update(id: string, input: UpdateTaskInput): Promise<Result<Task, TaskError>> {
    const [updated] = await this.db
      .update(tasks)
      .set({ ...input, updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    await this.db.delete(tasks).where(eq(tasks.id, id));
    return ok(undefined);
  }

  async moveColumn(
    id: string,
    column: TaskColumn,
    position?: number
  ): Promise<Result<Task, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    if (!canTransition(task.column, column)) {
      return err(TaskErrors.INVALID_TRANSITION(task.column, column));
    }

    let newPosition = position;
    if (newPosition === undefined) {
      const lastInColumn = await this.db.query.tasks.findFirst({
        where: and(eq(tasks.projectId, task.projectId), eq(tasks.column, column)),
        orderBy: desc(tasks.position),
      });
      newPosition = (lastInColumn?.position ?? -1) + 1;
    }

    const [updated] = await this.db
      .update(tasks)
      .set({
        column,
        position: newPosition,
        updatedAt: new Date().toISOString(),
        ...(column === 'in_progress' ? { startedAt: new Date().toISOString() } : {}),
        ...(column === 'verified' ? { completedAt: new Date().toISOString() } : {}),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return err(TaskErrors.NOT_FOUND);
    }

    // Trigger container agent when moving to in_progress (if sandbox is enabled)
    if (column === 'in_progress' && this.containerAgentService) {
      await this.triggerContainerAgent(updated);
    }

    return ok(updated);
  }

  /**
   * Trigger container agent execution for a task if sandbox is enabled.
   */
  private async triggerContainerAgent(task: Task): Promise<void> {
    if (!this.containerAgentService) {
      return;
    }

    // Check if agent is already running for this task
    if (this.containerAgentService.isAgentRunning(task.id)) {
      console.log(`[TaskService] Agent already running for task ${task.id}, skipping trigger`);
      return;
    }

    // Get project to check sandbox config
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, task.projectId),
    });

    if (!project) {
      console.warn(`[TaskService] Project not found for task ${task.id}, cannot trigger agent`);
      return;
    }

    const sandboxConfig = project.config?.sandbox as ProjectSandboxConfig | undefined;

    // Only trigger if sandbox is enabled
    if (!sandboxConfig?.enabled) {
      console.log(
        `[TaskService] Sandbox not enabled for project ${project.id}, skipping container agent`
      );
      return;
    }

    // Build task prompt
    const prompt = this.buildTaskPrompt(task);

    // Generate session ID for this agent run
    const sessionId = task.sessionId ?? createId();

    // Trigger agent execution (fire-and-forget)
    void this.containerAgentService
      .startAgent({
        projectId: task.projectId,
        taskId: task.id,
        sessionId,
        prompt,
        model: project.config?.model,
        maxTurns: project.config?.maxTurns,
      })
      .then((result) => {
        if (!result.ok) {
          console.error(
            `[TaskService] Failed to start container agent for task ${task.id}:`,
            result.error
          );
        } else {
          console.log(`[TaskService] Container agent started for task ${task.id}`);
        }
      })
      .catch((error) => {
        console.error(`[TaskService] Error starting container agent for task ${task.id}:`, error);
      });

    // Update task with session ID if it was generated
    if (!task.sessionId) {
      await this.db
        .update(tasks)
        .set({ sessionId, updatedAt: new Date().toISOString() })
        .where(eq(tasks.id, task.id));
    }
  }

  /**
   * Build the prompt for container agent execution.
   */
  private buildTaskPrompt(task: Task): string {
    const parts = [
      'Work on the following task:',
      '',
      `Title: ${task.title}`,
      '',
      `Description: ${task.description ?? 'No description provided.'}`,
    ];

    if (task.labels && task.labels.length > 0) {
      parts.push('', `Labels: ${task.labels.join(', ')}`);
    }

    if (task.priority) {
      parts.push('', `Priority: ${task.priority}`);
    }

    parts.push(
      '',
      'The project is mounted at /workspace. Make the necessary changes to complete this task.',
      'When you are done, the task will be moved to review.'
    );

    return parts.join('\n');
  }

  async reorder(id: string, position: number): Promise<Result<Task, TaskError>> {
    const [updated] = await this.db
      .update(tasks)
      .set({ position, updatedAt: new Date().toISOString() })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async getByColumn(projectId: string, column: TaskColumn): Promise<Result<Task[], TaskError>> {
    const items = await this.db.query.tasks.findMany({
      where: and(eq(tasks.projectId, projectId), eq(tasks.column, column)),
      orderBy: desc(tasks.position),
    });

    return ok(items);
  }

  async approve(id: string, input: ApproveInput): Promise<Result<Task, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    if (task.column !== 'waiting_approval') {
      return err(TaskErrors.NOT_WAITING_APPROVAL(task.column));
    }

    if (task.approvedAt) {
      return err(TaskErrors.ALREADY_APPROVED);
    }

    if (!task.worktreeId) {
      return err(TaskErrors.NO_DIFF);
    }

    const diff = await this.worktreeService.getDiff(task.worktreeId);
    if (!diff.ok) {
      return diff;
    }

    if (diff.value.stats.filesChanged === 0) {
      return err(TaskErrors.NO_DIFF);
    }

    if (input.createMergeCommit !== false) {
      const mergeResult = await this.worktreeService.merge(task.worktreeId);
      if (!mergeResult.ok) {
        return mergeResult;
      }
    }

    const [updated] = await this.db
      .update(tasks)
      .set({
        column: 'verified',
        approvedAt: new Date().toISOString(),
        approvedBy: input.approvedBy,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        diffSummary: diff.value.stats,
      })
      .where(eq(tasks.id, id))
      .returning();

    if (task.worktreeId) {
      await this.worktreeService.remove(task.worktreeId);
    }

    if (!updated) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async reject(id: string, input: RejectInput): Promise<Result<Task, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    if (task.column !== 'waiting_approval') {
      return err(TaskErrors.NOT_WAITING_APPROVAL(task.column));
    }

    if (!input.reason || input.reason.length < 1 || input.reason.length > 1000) {
      return err(ValidationErrors.INVALID_ENUM_VALUE('reason', input.reason, ['1-1000 chars']));
    }

    const [updated] = await this.db
      .update(tasks)
      .set({
        column: 'in_progress',
        rejectionCount: (task.rejectionCount ?? 0) + 1,
        rejectionReason: input.reason,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, id))
      .returning();

    if (!updated) {
      return err(TaskErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async getDiff(id: string): Promise<Result<DiffResult, TaskError>> {
    const task = await this.db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!task) {
      return err(TaskErrors.NOT_FOUND);
    }

    if (!task.worktreeId || !task.branch) {
      return err(TaskErrors.NO_DIFF);
    }

    const diff = await this.worktreeService.getDiff(task.worktreeId);
    if (!diff.ok) {
      return diff;
    }

    return ok({
      taskId: task.id,
      branch: task.branch,
      baseBranch: 'main',
      files: diff.value.files,
      summary: diff.value.stats,
    });
  }
}
