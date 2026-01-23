/**
 * API Handler Functions
 *
 * Extracted from api.ts for testability via dependency injection.
 * All handlers accept database and service dependencies as parameters.
 */

import { and, desc, eq } from 'drizzle-orm';
import { agents } from '../db/schema/agents.js';
import { projects } from '../db/schema/projects.js';
import { tasks } from '../db/schema/tasks.js';
import type { ApiKeyService } from '../services/api-key.service.js';
import type { MarketplaceService } from '../services/marketplace.service.js';
import type { SandboxConfigService } from '../services/sandbox-config.service.js';
import type { SessionService } from '../services/session.service.js';
import type { TaskService } from '../services/task.service.js';
import type { TemplateService } from '../services/template.service.js';
import type { Database } from '../types/database.js';

// ============ Types ============

export type HandlerDependencies = {
  db: Database;
  taskService: TaskService;
  templateService: TemplateService;
  sessionService: SessionService;
  apiKeyService: ApiKeyService;
  sandboxConfigService: SandboxConfigService;
  marketplaceService: MarketplaceService;
};

export type ApiResponse<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: { code: string; message: string; status?: number };
  pagination?: { limit?: number; offset?: number; hasMore?: boolean; total?: number };
};

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
};

// ============ Project Handler Functions ============

export async function listProjects(
  db: Database,
  options: { limit?: number } = {}
): Promise<ApiResponse<PaginatedResponse<unknown>>> {
  const limit = options.limit ?? 24;

  try {
    const items = await db.query.projects.findMany({
      orderBy: [desc(projects.updatedAt)],
      limit,
    });

    return {
      ok: true,
      data: {
        items: items.map((p) => ({
          id: p.id,
          name: p.name,
          path: p.path,
          description: p.description,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        })),
        nextCursor: null,
        hasMore: false,
        totalCount: items.length,
      },
    };
  } catch (error) {
    console.error('[Projects] List error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list projects', status: 500 },
    };
  }
}

export async function getProject(
  db: Database,
  id: string
): Promise<
  ApiResponse<{
    id: string;
    name: string;
    path: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>
> {
  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Project not found', status: 404 },
      };
    }

    return {
      ok: true,
      data: {
        id: project.id,
        name: project.name,
        path: project.path,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    };
  } catch (error) {
    console.error('[Projects] Get error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get project', status: 500 },
    };
  }
}

export async function createProject(
  db: Database,
  input: { name: string; path: string; description?: string }
): Promise<
  ApiResponse<{
    id: string;
    name: string;
    path: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  }>
> {
  if (!input.name || !input.path) {
    return {
      ok: false,
      error: { code: 'MISSING_PARAMS', message: 'Name and path are required', status: 400 },
    };
  }

  try {
    // Check if project with this path already exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.path, input.path),
    });

    if (existing) {
      return {
        ok: false,
        error: {
          code: 'DUPLICATE',
          message: 'A project with this path already exists',
          status: 400,
        },
      };
    }

    const [created] = await db
      .insert(projects)
      .values({
        name: input.name,
        path: input.path,
        description: input.description,
      })
      .returning();

    if (!created) {
      return {
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to create project', status: 500 },
      };
    }

    return {
      ok: true,
      data: {
        id: created.id,
        name: created.name,
        path: created.path,
        description: created.description,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    };
  } catch (error) {
    console.error('[Projects] Create error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to create project', status: 500 },
    };
  }
}

export async function updateProject(
  db: Database,
  id: string,
  input: {
    name?: string;
    description?: string;
    maxConcurrentAgents?: number;
    config?: Record<string, unknown>;
  }
): Promise<ApiResponse<unknown>> {
  try {
    // Check if project exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Project not found', status: 404 },
      };
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    if (input.maxConcurrentAgents !== undefined) {
      updateData.maxConcurrentAgents = input.maxConcurrentAgents;
    }
    if (input.config !== undefined) {
      // Merge with existing config
      updateData.config = { ...(existing.config ?? {}), ...input.config };
    }

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return {
        ok: false,
        error: { code: 'DB_ERROR', message: 'Failed to update project', status: 500 },
      };
    }

    return {
      ok: true,
      data: {
        id: updated.id,
        name: updated.name,
        path: updated.path,
        description: updated.description,
        maxConcurrentAgents: updated.maxConcurrentAgents,
        config: updated.config,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      },
    };
  } catch (error) {
    console.error('[Projects] Update error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to update project', status: 500 },
    };
  }
}

export async function deleteProject(
  db: Database,
  id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    // Check if project exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existing) {
      return {
        ok: false,
        error: { code: 'NOT_FOUND', message: 'Project not found', status: 404 },
      };
    }

    // Check if project has running agents
    const runningAgents = await db.query.agents.findMany({
      where: and(eq(agents.projectId, id), eq(agents.status, 'running')),
    });

    if (runningAgents.length > 0) {
      return {
        ok: false,
        error: {
          code: 'PROJECT_HAS_RUNNING_AGENTS',
          message: 'Cannot delete project with running agents. Stop all agents first.',
          status: 409,
        },
      };
    }

    // Delete associated tasks first (foreign key constraint)
    await db.delete(tasks).where(eq(tasks.projectId, id));

    // Delete associated agents
    await db.delete(agents).where(eq(agents.projectId, id));

    // Delete the project
    await db.delete(projects).where(eq(projects.id, id));

    return { ok: true, data: { deleted: true } };
  } catch (error) {
    console.error('[Projects] Delete error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to delete project', status: 500 },
    };
  }
}

export async function listProjectsWithSummaries(
  db: Database,
  options: { limit?: number } = {}
): Promise<ApiResponse<PaginatedResponse<unknown>>> {
  const limit = options.limit ?? 24;

  try {
    const projectList = await db.query.projects.findMany({
      orderBy: [desc(projects.updatedAt)],
      limit,
    });

    const summaries = await Promise.all(
      projectList.map(async (project) => {
        // Get task counts by column
        const projectTasks = await db.query.tasks.findMany({
          where: eq(tasks.projectId, project.id),
        });

        const taskCounts = {
          backlog: projectTasks.filter((t) => t.column === 'backlog').length,
          queued: projectTasks.filter((t) => t.column === 'queued').length,
          inProgress: projectTasks.filter((t) => t.column === 'in_progress').length,
          waitingApproval: projectTasks.filter((t) => t.column === 'waiting_approval').length,
          verified: projectTasks.filter((t) => t.column === 'verified').length,
          total: projectTasks.length,
        };

        // Get running agents for this project
        const runningAgents = await db.query.agents.findMany({
          where: and(eq(agents.projectId, project.id), eq(agents.status, 'running')),
        });

        // Get task titles for running agents
        const agentData = await Promise.all(
          runningAgents.map(async (agent) => {
            let taskTitle: string | undefined;
            if (agent.currentTaskId) {
              const task = await db.query.tasks.findFirst({
                where: eq(tasks.id, agent.currentTaskId),
              });
              taskTitle = task?.title;
            }
            return {
              id: agent.id,
              name: agent.name ?? 'Agent',
              currentTaskId: agent.currentTaskId,
              currentTaskTitle: taskTitle,
            };
          })
        );

        // Determine project status
        let status: 'running' | 'idle' | 'needs-approval' = 'idle';
        if (runningAgents.length > 0) {
          status = 'running';
        } else if (taskCounts.waitingApproval > 0) {
          status = 'needs-approval';
        }

        // Get last activity from tasks
        const lastTask = projectTasks.sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        })[0];

        return {
          project: {
            id: project.id,
            name: project.name,
            path: project.path,
            description: project.description,
            createdAt: project.createdAt,
            updatedAt: project.updatedAt,
          },
          taskCounts,
          runningAgents: agentData,
          status,
          lastActivityAt: lastTask?.updatedAt ?? project.updatedAt,
        };
      })
    );

    return {
      ok: true,
      data: {
        items: summaries,
        nextCursor: null,
        hasMore: false,
        totalCount: summaries.length,
      },
    };
  } catch (error) {
    console.error('[Projects] List with summaries error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list projects with summaries', status: 500 },
    };
  }
}

// ============ Task Handler Functions ============

export async function listTasks(
  taskService: TaskService,
  options: {
    projectId: string;
    column?: 'backlog' | 'queued' | 'in_progress' | 'waiting_approval' | 'verified';
    limit?: number;
    offset?: number;
  }
): Promise<ApiResponse<PaginatedResponse<unknown>>> {
  if (!options.projectId) {
    return {
      ok: false,
      error: { code: 'MISSING_PARAMS', message: 'projectId is required', status: 400 },
    };
  }

  try {
    const result = await taskService.list(options.projectId, {
      column: options.column,
      limit: options.limit ?? 50,
      offset: options.offset ?? 0,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: result.value,
        nextCursor: null,
        hasMore: false,
        totalCount: result.value.length,
      },
    };
  } catch (error) {
    console.error('[Tasks] List error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list tasks', status: 500 },
    };
  }
}

export async function getTask(taskService: TaskService, id: string): Promise<ApiResponse<unknown>> {
  try {
    const result = await taskService.getById(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Tasks] Get error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get task', status: 500 },
    };
  }
}

export async function createTask(
  taskService: TaskService,
  input: {
    projectId: string;
    title: string;
    description?: string;
    labels?: string[];
    priority?: 'high' | 'medium' | 'low';
  }
): Promise<ApiResponse<unknown>> {
  if (!input.projectId || !input.title) {
    return {
      ok: false,
      error: { code: 'MISSING_PARAMS', message: 'projectId and title are required', status: 400 },
    };
  }

  try {
    const result = await taskService.create({
      projectId: input.projectId,
      title: input.title,
      description: input.description,
      labels: input.labels,
      priority: input.priority,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Tasks] Create error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to create task', status: 500 },
    };
  }
}

export async function updateTask(
  taskService: TaskService,
  id: string,
  input: {
    title?: string;
    description?: string;
    labels?: string[];
    priority?: 'high' | 'medium' | 'low';
  }
): Promise<ApiResponse<unknown>> {
  try {
    const result = await taskService.update(id, {
      title: input.title,
      description: input.description,
      labels: input.labels,
      priority: input.priority,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Tasks] Update error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to update task', status: 500 },
    };
  }
}

export async function deleteTask(taskService: TaskService, id: string): Promise<ApiResponse<null>> {
  try {
    const result = await taskService.delete(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: null };
  } catch (error) {
    console.error('[Tasks] Delete error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to delete task', status: 500 },
    };
  }
}

// ============ Template Handler Functions ============

export async function listTemplates(
  templateService: TemplateService,
  options: {
    scope?: 'org' | 'project';
    projectId?: string;
    limit?: number;
  } = {}
): Promise<ApiResponse<PaginatedResponse<unknown>>> {
  try {
    const result = await templateService.list({
      scope: options.scope,
      projectId: options.projectId,
      limit: options.limit ?? 50,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: result.value,
        nextCursor: null,
        hasMore: false,
        totalCount: result.value.length,
      },
    };
  } catch (error) {
    console.error('[Templates] List error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list templates', status: 500 },
    };
  }
}

export async function getTemplate(
  templateService: TemplateService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await templateService.getById(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Templates] Get error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get template', status: 500 },
    };
  }
}

export async function createTemplate(
  templateService: TemplateService,
  input: {
    name: string;
    description?: string;
    scope: 'org' | 'project';
    githubUrl: string;
    branch?: string;
    configPath?: string;
    projectId?: string;
    projectIds?: string[];
  }
): Promise<ApiResponse<unknown>> {
  try {
    const result = await templateService.create({
      name: input.name,
      description: input.description,
      scope: input.scope,
      githubUrl: input.githubUrl,
      branch: input.branch,
      configPath: input.configPath,
      projectId: input.projectId,
      projectIds: input.projectIds,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Templates] Create error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to create template', status: 500 },
    };
  }
}

export async function updateTemplate(
  templateService: TemplateService,
  id: string,
  input: {
    name?: string;
    description?: string;
    branch?: string;
    configPath?: string;
    projectIds?: string[];
  }
): Promise<ApiResponse<unknown>> {
  try {
    const result = await templateService.update(id, {
      name: input.name,
      description: input.description,
      branch: input.branch,
      configPath: input.configPath,
      projectIds: input.projectIds,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Templates] Update error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to update template', status: 500 },
    };
  }
}

export async function deleteTemplate(
  templateService: TemplateService,
  id: string
): Promise<ApiResponse<null>> {
  try {
    const result = await templateService.delete(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: null };
  } catch (error) {
    console.error('[Templates] Delete error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to delete template', status: 500 },
    };
  }
}

export async function syncTemplate(
  templateService: TemplateService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await templateService.sync(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Templates] Sync error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to sync template', status: 500 },
    };
  }
}

// ============ Session Handler Functions ============

export async function listSessions(
  sessionService: SessionService,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<unknown>> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  try {
    const result = await sessionService.list({ limit, offset });
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.error.code, message: result.error.message, status: 400 },
      };
    }

    return {
      ok: true,
      data: result.value,
      pagination: {
        limit,
        offset,
        hasMore: result.value.length === limit,
      },
    };
  } catch (error) {
    console.error('[Sessions] List error:', error);
    return {
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to list sessions', status: 500 },
    };
  }
}

export async function getSession(
  sessionService: SessionService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await sessionService.getById(id);
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.error.code, message: result.error.message, status: 404 },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Sessions] Get error:', error);
    return {
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get session', status: 500 },
    };
  }
}

export async function getSessionEvents(
  sessionService: SessionService,
  id: string,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<unknown>> {
  try {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const result = await sessionService.getEventsBySession(id, { limit, offset });
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.error.code, message: result.error.message, status: 404 },
      };
    }

    return {
      ok: true,
      data: result.value,
      pagination: { total: result.value.length, limit, offset },
    };
  } catch (error) {
    console.error('[Sessions] Get events error:', error);
    return {
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get session events', status: 500 },
    };
  }
}

export async function getSessionSummary(
  sessionService: SessionService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await sessionService.getSessionSummary(id);
    if (!result.ok) {
      return {
        ok: false,
        error: { code: result.error.code, message: result.error.message, status: 404 },
      };
    }

    // Return default values if no summary exists yet
    const summary = result.value ?? {
      sessionId: id,
      durationMs: null,
      turnsCount: 0,
      tokensUsed: 0,
      filesModified: 0,
      linesAdded: 0,
      linesRemoved: 0,
      finalStatus: null,
    };

    return { ok: true, data: summary };
  } catch (error) {
    console.error('[Sessions] Get summary error:', error);
    return {
      ok: false,
      error: { code: 'SERVER_ERROR', message: 'Failed to get session summary', status: 500 },
    };
  }
}

// ============ API Key Handler Functions ============

export async function getApiKey(
  apiKeyService: ApiKeyService,
  service: string
): Promise<ApiResponse<{ keyInfo: unknown }>> {
  const result = await apiKeyService.getKeyInfo(service);

  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.error.code, message: result.error.message, status: 500 },
    };
  }

  return { ok: true, data: { keyInfo: result.value } };
}

export async function saveApiKey(
  apiKeyService: ApiKeyService,
  service: string,
  key: string
): Promise<ApiResponse<{ keyInfo: unknown }>> {
  if (!key) {
    return {
      ok: false,
      error: { code: 'MISSING_PARAMS', message: 'API key is required', status: 400 },
    };
  }

  const result = await apiKeyService.saveKey(service, key);

  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.error.code, message: result.error.message, status: 400 },
    };
  }

  return { ok: true, data: { keyInfo: result.value } };
}

export async function deleteApiKey(
  apiKeyService: ApiKeyService,
  service: string
): Promise<ApiResponse<null>> {
  const result = await apiKeyService.deleteKey(service);

  if (!result.ok) {
    return {
      ok: false,
      error: { code: result.error.code, message: result.error.message, status: 500 },
    };
  }

  return { ok: true, data: null };
}

// ============ Sandbox Config Handler Functions ============

export async function listSandboxConfigs(
  sandboxConfigService: SandboxConfigService,
  options: { limit?: number; offset?: number } = {}
): Promise<ApiResponse<{ items: unknown[]; totalCount: number }>> {
  const limit = options.limit ?? 50;
  const offset = options.offset ?? 0;

  try {
    const result = await sandboxConfigService.list({ limit, offset });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: result.value,
        totalCount: result.value.length,
      },
    };
  } catch (error) {
    console.error('[SandboxConfigs] List error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list sandbox configs', status: 500 },
    };
  }
}

export async function getSandboxConfig(
  sandboxConfigService: SandboxConfigService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await sandboxConfigService.getById(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[SandboxConfigs] Get error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get sandbox config', status: 500 },
    };
  }
}

export async function createSandboxConfig(
  sandboxConfigService: SandboxConfigService,
  input: {
    name: string;
    description?: string;
    isDefault?: boolean;
    baseImage?: string;
    memoryMb?: number;
    cpuCores?: number;
    maxProcesses?: number;
    timeoutMinutes?: number;
  }
): Promise<ApiResponse<unknown>> {
  if (!input.name) {
    return {
      ok: false,
      error: { code: 'MISSING_PARAMS', message: 'Name is required', status: 400 },
    };
  }

  try {
    const result = await sandboxConfigService.create({
      name: input.name,
      description: input.description,
      isDefault: input.isDefault,
      baseImage: input.baseImage,
      memoryMb: input.memoryMb,
      cpuCores: input.cpuCores,
      maxProcesses: input.maxProcesses,
      timeoutMinutes: input.timeoutMinutes,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[SandboxConfigs] Create error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to create sandbox config', status: 500 },
    };
  }
}

export async function updateSandboxConfig(
  sandboxConfigService: SandboxConfigService,
  id: string,
  input: {
    name?: string;
    description?: string;
    isDefault?: boolean;
    baseImage?: string;
    memoryMb?: number;
    cpuCores?: number;
    maxProcesses?: number;
    timeoutMinutes?: number;
  }
): Promise<ApiResponse<unknown>> {
  try {
    const result = await sandboxConfigService.update(id, {
      name: input.name,
      description: input.description,
      isDefault: input.isDefault,
      baseImage: input.baseImage,
      memoryMb: input.memoryMb,
      cpuCores: input.cpuCores,
      maxProcesses: input.maxProcesses,
      timeoutMinutes: input.timeoutMinutes,
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[SandboxConfigs] Update error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to update sandbox config', status: 500 },
    };
  }
}

export async function deleteSandboxConfig(
  sandboxConfigService: SandboxConfigService,
  id: string
): Promise<ApiResponse<null>> {
  try {
    const result = await sandboxConfigService.delete(id);

    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: null };
  } catch (error) {
    console.error('[SandboxConfigs] Delete error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to delete sandbox config', status: 500 },
    };
  }
}

// ============ Marketplace Handler Functions ============

export async function listMarketplaces(
  marketplaceService: MarketplaceService,
  options: { limit?: number; includeDisabled?: boolean } = {}
): Promise<ApiResponse<{ items: unknown[]; totalCount: number }>> {
  try {
    const limit = options.limit ?? 20;
    const includeDisabled = options.includeDisabled ?? false;

    const result = await marketplaceService.list({ limit, includeDisabled });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: result.value.map((m) => ({
          id: m.id,
          name: m.name,
          githubOwner: m.githubOwner,
          githubRepo: m.githubRepo,
          branch: m.branch,
          pluginsPath: m.pluginsPath,
          isDefault: m.isDefault,
          isEnabled: m.isEnabled,
          status: m.status,
          lastSyncedAt: m.lastSyncedAt,
          syncError: m.syncError,
          pluginCount: (m.cachedPlugins ?? []).length,
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        })),
        totalCount: result.value.length,
      },
    };
  } catch (error) {
    console.error('[Marketplaces] List error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list marketplaces', status: 500 },
    };
  }
}

export async function getMarketplace(
  marketplaceService: MarketplaceService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    const result = await marketplaceService.getById(id);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    const m = result.value;
    return {
      ok: true,
      data: {
        id: m.id,
        name: m.name,
        githubOwner: m.githubOwner,
        githubRepo: m.githubRepo,
        branch: m.branch,
        pluginsPath: m.pluginsPath,
        isDefault: m.isDefault,
        isEnabled: m.isEnabled,
        status: m.status,
        lastSyncedAt: m.lastSyncedAt,
        syncError: m.syncError,
        plugins: m.cachedPlugins ?? [],
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      },
    };
  } catch (error) {
    console.error('[Marketplaces] Get error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get marketplace', status: 500 },
    };
  }
}

export async function createMarketplace(
  marketplaceService: MarketplaceService,
  input: {
    name: string;
    githubUrl?: string;
    githubOwner?: string;
    githubRepo?: string;
    branch?: string;
    pluginsPath?: string;
  }
): Promise<ApiResponse<unknown>> {
  if (!input.name) {
    return {
      ok: false,
      error: { code: 'MISSING_NAME', message: 'Name is required', status: 400 },
    };
  }

  if (!input.githubUrl && (!input.githubOwner || !input.githubRepo)) {
    return {
      ok: false,
      error: { code: 'MISSING_REPO', message: 'GitHub URL or owner/repo required', status: 400 },
    };
  }

  try {
    const result = await marketplaceService.create(input);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Marketplaces] Create error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to create marketplace', status: 500 },
    };
  }
}

export async function deleteMarketplace(
  marketplaceService: MarketplaceService,
  id: string
): Promise<ApiResponse<{ deleted: boolean }>> {
  try {
    const result = await marketplaceService.delete(id);
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: { deleted: true } };
  } catch (error) {
    console.error('[Marketplaces] Delete error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to delete marketplace', status: 500 },
    };
  }
}

export async function syncMarketplace(
  marketplaceService: MarketplaceService,
  id: string
): Promise<ApiResponse<unknown>> {
  try {
    console.log(`[Marketplaces] Syncing marketplace ${id}`);
    const result = await marketplaceService.sync(id);
    if (!result.ok) {
      console.error(`[Marketplaces] Sync failed for ${id}:`, result.error);
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    console.log(`[Marketplaces] Synced ${result.value.pluginCount} plugins for ${id}`);
    return { ok: true, data: result.value };
  } catch (error) {
    console.error('[Marketplaces] Sync error:', error);
    return {
      ok: false,
      error: { code: 'SYNC_ERROR', message: 'Failed to sync marketplace', status: 500 },
    };
  }
}

export async function listPlugins(
  marketplaceService: MarketplaceService,
  options: {
    search?: string;
    category?: string;
    marketplaceId?: string;
  } = {}
): Promise<ApiResponse<{ items: unknown[]; totalCount: number }>> {
  try {
    const result = await marketplaceService.listAllPlugins({
      search: options.search,
      category: options.category,
      marketplaceId: options.marketplaceId,
    });
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: {
        items: result.value,
        totalCount: result.value.length,
      },
    };
  } catch (error) {
    console.error('[Marketplaces] List plugins error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to list plugins', status: 500 },
    };
  }
}

export async function getCategories(
  marketplaceService: MarketplaceService
): Promise<ApiResponse<{ categories: string[] }>> {
  try {
    const result = await marketplaceService.getCategories();
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return {
      ok: true,
      data: { categories: result.value },
    };
  } catch (error) {
    console.error('[Marketplaces] Get categories error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to get categories', status: 500 },
    };
  }
}

export async function seedDefaultMarketplace(
  marketplaceService: MarketplaceService
): Promise<ApiResponse<{ seeded: boolean }>> {
  try {
    const result = await marketplaceService.seedDefaultMarketplace();
    if (!result.ok) {
      return {
        ok: false,
        error: {
          code: result.error.code,
          message: result.error.message,
          status: result.error.status,
        },
      };
    }

    return { ok: true, data: { seeded: result.value !== null } };
  } catch (error) {
    console.error('[Marketplaces] Seed error:', error);
    return {
      ok: false,
      error: { code: 'DB_ERROR', message: 'Failed to seed marketplace', status: 500 },
    };
  }
}

// ============ Helper Functions ============

/**
 * Validate that an ID is safe and properly formatted
 * Accepts cuid2 IDs and kebab-case string IDs
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Length check: reasonable ID lengths (1-100 chars)
  if (id.length < 1 || id.length > 100) return false;
  // Only allow alphanumeric, hyphens, underscores (safe for paths/queries)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

// ============ Factory Function ============

/**
 * Creates all handlers with injected dependencies
 */
export function createHandlers(deps: HandlerDependencies) {
  return {
    // Project handlers
    listProjects: (options?: { limit?: number }) => listProjects(deps.db, options),
    getProject: (id: string) => getProject(deps.db, id),
    createProject: (input: { name: string; path: string; description?: string }) =>
      createProject(deps.db, input),
    updateProject: (
      id: string,
      input: {
        name?: string;
        description?: string;
        maxConcurrentAgents?: number;
        config?: Record<string, unknown>;
      }
    ) => updateProject(deps.db, id, input),
    deleteProject: (id: string) => deleteProject(deps.db, id),
    listProjectsWithSummaries: (options?: { limit?: number }) =>
      listProjectsWithSummaries(deps.db, options),

    // Task handlers
    listTasks: (options: {
      projectId: string;
      column?: 'backlog' | 'queued' | 'in_progress' | 'waiting_approval' | 'verified';
      limit?: number;
      offset?: number;
    }) => listTasks(deps.taskService, options),
    getTask: (id: string) => getTask(deps.taskService, id),
    createTask: (input: {
      projectId: string;
      title: string;
      description?: string;
      labels?: string[];
      priority?: 'high' | 'medium' | 'low';
    }) => createTask(deps.taskService, input),
    updateTask: (
      id: string,
      input: {
        title?: string;
        description?: string;
        labels?: string[];
        priority?: 'high' | 'medium' | 'low';
      }
    ) => updateTask(deps.taskService, id, input),
    deleteTask: (id: string) => deleteTask(deps.taskService, id),

    // Template handlers
    listTemplates: (options?: { scope?: 'org' | 'project'; projectId?: string; limit?: number }) =>
      listTemplates(deps.templateService, options),
    getTemplate: (id: string) => getTemplate(deps.templateService, id),
    createTemplate: (input: {
      name: string;
      description?: string;
      scope: 'org' | 'project';
      githubUrl: string;
      branch?: string;
      configPath?: string;
      projectId?: string;
      projectIds?: string[];
    }) => createTemplate(deps.templateService, input),
    updateTemplate: (
      id: string,
      input: {
        name?: string;
        description?: string;
        branch?: string;
        configPath?: string;
        projectIds?: string[];
      }
    ) => updateTemplate(deps.templateService, id, input),
    deleteTemplate: (id: string) => deleteTemplate(deps.templateService, id),
    syncTemplate: (id: string) => syncTemplate(deps.templateService, id),

    // Session handlers
    listSessions: (options?: { limit?: number; offset?: number }) =>
      listSessions(deps.sessionService, options),
    getSession: (id: string) => getSession(deps.sessionService, id),
    getSessionEvents: (id: string, options?: { limit?: number; offset?: number }) =>
      getSessionEvents(deps.sessionService, id, options),
    getSessionSummary: (id: string) => getSessionSummary(deps.sessionService, id),

    // API Key handlers
    getApiKey: (service: string) => getApiKey(deps.apiKeyService, service),
    saveApiKey: (service: string, key: string) => saveApiKey(deps.apiKeyService, service, key),
    deleteApiKey: (service: string) => deleteApiKey(deps.apiKeyService, service),

    // Sandbox Config handlers
    listSandboxConfigs: (options?: { limit?: number; offset?: number }) =>
      listSandboxConfigs(deps.sandboxConfigService, options),
    getSandboxConfig: (id: string) => getSandboxConfig(deps.sandboxConfigService, id),
    createSandboxConfig: (input: {
      name: string;
      description?: string;
      isDefault?: boolean;
      baseImage?: string;
      memoryMb?: number;
      cpuCores?: number;
      maxProcesses?: number;
      timeoutMinutes?: number;
    }) => createSandboxConfig(deps.sandboxConfigService, input),
    updateSandboxConfig: (
      id: string,
      input: {
        name?: string;
        description?: string;
        isDefault?: boolean;
        baseImage?: string;
        memoryMb?: number;
        cpuCores?: number;
        maxProcesses?: number;
        timeoutMinutes?: number;
      }
    ) => updateSandboxConfig(deps.sandboxConfigService, id, input),
    deleteSandboxConfig: (id: string) => deleteSandboxConfig(deps.sandboxConfigService, id),

    // Marketplace handlers
    listMarketplaces: (options?: { limit?: number; includeDisabled?: boolean }) =>
      listMarketplaces(deps.marketplaceService, options),
    getMarketplace: (id: string) => getMarketplace(deps.marketplaceService, id),
    createMarketplace: (input: {
      name: string;
      githubUrl?: string;
      githubOwner?: string;
      githubRepo?: string;
      branch?: string;
      pluginsPath?: string;
    }) => createMarketplace(deps.marketplaceService, input),
    deleteMarketplace: (id: string) => deleteMarketplace(deps.marketplaceService, id),
    syncMarketplace: (id: string) => syncMarketplace(deps.marketplaceService, id),
    listPlugins: (options?: { search?: string; category?: string; marketplaceId?: string }) =>
      listPlugins(deps.marketplaceService, options),
    getCategories: () => getCategories(deps.marketplaceService),
    seedDefaultMarketplace: () => seedDefaultMarketplace(deps.marketplaceService),

    // Utility
    isValidId,
  };
}
