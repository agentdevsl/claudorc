/**
 * Bun API Server
 *
 * Handles API requests that need database access.
 * Runs alongside Vite dev server.
 */

import { Database as BunSQLite } from 'bun:sqlite';
import { createId } from '@paralleldrive/cuid2';
import { and, count, desc, eq, like, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { z } from 'zod';
import { agents } from '../db/schema/agents.js';
import * as schema from '../db/schema/index.js';
import { projects } from '../db/schema/projects.js';
import { tasks } from '../db/schema/tasks.js';
import type { CachedAgent, CachedCommand, CachedSkill } from '../db/schema/templates.js';
import { workflows } from '../db/schema/workflows.js';
import { agentQuery } from '../lib/agents/agent-sdk-utils.js';
import {
  MIGRATION_SQL,
  SANDBOX_MIGRATION_SQL,
  TEMPLATE_SYNC_INTERVAL_MIGRATION_SQL,
} from '../lib/bootstrap/phases/schema.js';
import {
  createWorkflowAnalysisPrompt,
  WORKFLOW_GENERATION_SYSTEM_PROMPT,
} from '../lib/workflow-dsl/ai-prompts.js';
import { layoutWorkflow } from '../lib/workflow-dsl/layout.js';
import type { Workflow, WorkflowEdge, WorkflowNode } from '../lib/workflow-dsl/types.js';
import { workflowEdgeSchema, workflowNodeSchema } from '../lib/workflow-dsl/types.js';
import { ApiKeyService } from '../services/api-key.service.js';
import type { DurableStreamsService } from '../services/durable-streams.service.js';
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
import { GitHubTokenService } from './github-token.service.js';
import {
  loadKubeConfig,
  resolveContext,
  getClusterInfo,
  K8S_PROVIDER_DEFAULTS,
} from '../lib/sandbox/providers/k8s-config.js';

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

/**
 * Validate that an ID is safe and properly formatted
 * Accepts cuid2 IDs and kebab-case string IDs
 */
function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Length check: reasonable ID lengths (1-100 chars)
  if (id.length < 1 || id.length > 100) return false;
  // Only allow alphanumeric, hyphens, underscores (safe for paths/queries)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

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
// TaskService with stub worktreeService for basic CRUD (approve/reject/getDiff not used in API)
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
  publishTaskCreationStarted: async () => undefined,
  publishTaskCreationMessage: async () => undefined,
  publishTaskCreationToken: async () => undefined,
  publishTaskCreationSuggestion: async () => undefined,
  publishTaskCreationError: async () => undefined,
  publishTaskCreationCompleted: async () => undefined,
  publishTaskCreationCancelled: async () => undefined,
} as unknown as DurableStreamsService;

// Mock DurableStreamsServer for SessionService
const mockStreamsServer: DurableStreamsServer = {
  createStream: async () => undefined,
  publish: async () => undefined,
  subscribe: async function* () {
    yield { type: 'chunk', data: {}, offset: 0 };
  },
};

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

// MarketplaceService for plugin marketplace operations
const marketplaceService = new MarketplaceService(db);

// ============ Project Handlers ============

async function handleListProjects(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') ?? '24', 10);

  try {
    const items = await db.query.projects.findMany({
      orderBy: [desc(projects.updatedAt)],
      limit,
    });

    return json({
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
    });
  } catch (error) {
    console.error('[Projects] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list projects' } },
      500
    );
  }
}

async function handleGetProject(id: string): Promise<Response> {
  try {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    return json({
      ok: true,
      data: {
        id: project.id,
        name: project.name,
        path: project.path,
        description: project.description,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Projects] Get error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get project' } }, 500);
  }
}

async function handleCreateProject(request: Request): Promise<Response> {
  const body = (await request.json()) as { name: string; path: string; description?: string };

  if (!body.name || !body.path) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'Name and path are required' } },
      400
    );
  }

  try {
    // Check if project with this path already exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.path, body.path),
    });

    if (existing) {
      return json(
        {
          ok: false,
          error: { code: 'DUPLICATE', message: 'A project with this path already exists' },
        },
        400
      );
    }

    const [created] = await db
      .insert(projects)
      .values({
        name: body.name,
        path: body.path,
        description: body.description,
      })
      .returning();

    if (!created) {
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create project' } },
        500
      );
    }

    return json({
      ok: true,
      data: {
        id: created.id,
        name: created.name,
        path: created.path,
        description: created.description,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      },
    });
  } catch (error) {
    console.error('[Projects] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create project' } },
      500
    );
  }
}

async function handleUpdateProject(id: string, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    maxConcurrentAgents?: number;
    config?: Record<string, unknown>;
  };

  try {
    // Check if project exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existing) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      updateData.name = body.name;
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.maxConcurrentAgents !== undefined) {
      updateData.maxConcurrentAgents = body.maxConcurrentAgents;
    }
    if (body.config !== undefined) {
      // Merge with existing config
      updateData.config = { ...(existing.config ?? {}), ...body.config };
    }

    const [updated] = await db
      .update(projects)
      .set(updateData)
      .where(eq(projects.id, id))
      .returning();

    if (!updated) {
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update project' } },
        500
      );
    }

    return json({
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
    });
  } catch (error) {
    console.error('[Projects] Update error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update project' } },
      500
    );
  }
}

async function handleDeleteProject(id: string): Promise<Response> {
  try {
    // Check if project exists
    const existing = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!existing) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Check if project has running agents
    const runningAgents = await db.query.agents.findMany({
      where: and(eq(agents.projectId, id), eq(agents.status, 'running')),
    });

    if (runningAgents.length > 0) {
      return json(
        {
          ok: false,
          error: {
            code: 'PROJECT_HAS_RUNNING_AGENTS',
            message: 'Cannot delete project with running agents. Stop all agents first.',
          },
        },
        409
      );
    }

    // Delete associated tasks first (foreign key constraint)
    await db.delete(tasks).where(eq(tasks.projectId, id));

    // Delete associated agents
    await db.delete(agents).where(eq(agents.projectId, id));

    // Delete the project
    await db.delete(projects).where(eq(projects.id, id));

    return json({ ok: true, data: { deleted: true } });
  } catch (error) {
    console.error('[Projects] Delete error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete project' } },
      500
    );
  }
}

async function handleListProjectsWithSummaries(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') ?? '24', 10);

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

    return json({
      ok: true,
      data: {
        items: summaries,
        nextCursor: null,
        hasMore: false,
        totalCount: summaries.length,
      },
    });
  } catch (error) {
    console.error('[Projects] List with summaries error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list projects with summaries' } },
      500
    );
  }
}

// ============ Workflow Handlers ============

async function handleListWorkflows(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  try {
    // Build where conditions
    const conditions = [];

    if (status && ['draft', 'published', 'archived'].includes(status)) {
      conditions.push(eq(workflows.status, status as 'draft' | 'published' | 'archived'));
    }

    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(like(workflows.name, searchPattern), like(workflows.description, searchPattern))
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // Get total count
    const [countResult] = await db.select({ total: count() }).from(workflows).where(whereClause);

    const totalCount = countResult?.total ?? 0;

    // Get paginated items
    const items = await db.query.workflows.findMany({
      where: whereClause,
      orderBy: [desc(workflows.updatedAt)],
      limit,
      offset,
    });

    return json({
      ok: true,
      data: {
        items,
        totalCount,
        limit,
        offset,
        hasMore: offset + items.length < totalCount,
      },
    });
  } catch (error) {
    console.error('[Workflows] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list workflows' } },
      500
    );
  }
}

async function handleGetWorkflow(id: string): Promise<Response> {
  try {
    const workflow = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!workflow) {
      return json(
        { ok: false, error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` } },
        404
      );
    }

    return json({ ok: true, data: workflow });
  } catch (error) {
    console.error('[Workflows] Get error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get workflow' } }, 500);
  }
}

async function handleCreateWorkflow(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
    viewport?: { x: number; y: number; zoom: number };
    status?: string;
    tags?: string[];
    sourceTemplateId?: string;
    sourceTemplateName?: string;
    thumbnail?: string;
    aiGenerated?: boolean;
    aiModel?: string;
    aiConfidence?: number;
  };

  if (!body.name) {
    return json({ ok: false, error: { code: 'MISSING_PARAMS', message: 'Name is required' } }, 400);
  }

  try {
    const now = new Date().toISOString();

    const [created] = await db
      .insert(workflows)
      .values({
        name: body.name,
        description: body.description,
        nodes: body.nodes as typeof workflows.$inferInsert.nodes,
        edges: body.edges as typeof workflows.$inferInsert.edges,
        viewport: body.viewport,
        status: (body.status as 'draft' | 'published' | 'archived') ?? 'draft',
        tags: body.tags,
        sourceTemplateId: body.sourceTemplateId,
        sourceTemplateName: body.sourceTemplateName,
        thumbnail: body.thumbnail,
        aiGenerated: body.aiGenerated,
        aiModel: body.aiModel,
        aiConfidence: body.aiConfidence,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!created) {
      return json(
        { ok: false, error: { code: 'CREATE_FAILED', message: 'Failed to create workflow' } },
        500
      );
    }

    return json({ ok: true, data: created }, 201);
  } catch (error) {
    console.error('[Workflows] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create workflow' } },
      500
    );
  }
}

async function handleUpdateWorkflow(id: string, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    name?: string;
    description?: string;
    nodes?: unknown[];
    edges?: unknown[];
    viewport?: { x: number; y: number; zoom: number };
    status?: string;
    tags?: string[];
    sourceTemplateId?: string | null;
    sourceTemplateName?: string | null;
    thumbnail?: string | null;
    aiGenerated?: boolean;
    aiModel?: string | null;
    aiConfidence?: number | null;
  };

  try {
    // Check if workflow exists
    const existing = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!existing) {
      return json(
        { ok: false, error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` } },
        404
      );
    }

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {
      updatedAt: new Date().toISOString(),
    };

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.nodes !== undefined) updates.nodes = body.nodes;
    if (body.edges !== undefined) updates.edges = body.edges;
    if (body.viewport !== undefined) updates.viewport = body.viewport;
    if (body.status !== undefined)
      updates.status = body.status as 'draft' | 'published' | 'archived';
    if (body.tags !== undefined) updates.tags = body.tags;
    if (body.sourceTemplateId !== undefined) updates.sourceTemplateId = body.sourceTemplateId;
    if (body.sourceTemplateName !== undefined) updates.sourceTemplateName = body.sourceTemplateName;
    if (body.thumbnail !== undefined) updates.thumbnail = body.thumbnail;
    if (body.aiGenerated !== undefined) updates.aiGenerated = body.aiGenerated;
    if (body.aiModel !== undefined) updates.aiModel = body.aiModel;
    if (body.aiConfidence !== undefined) updates.aiConfidence = body.aiConfidence;

    const [updated] = await db
      .update(workflows)
      .set(updates)
      .where(eq(workflows.id, id))
      .returning();

    if (!updated) {
      return json(
        { ok: false, error: { code: 'UPDATE_FAILED', message: 'Failed to update workflow' } },
        500
      );
    }

    return json({ ok: true, data: updated });
  } catch (error) {
    console.error('[Workflows] Update error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update workflow' } },
      500
    );
  }
}

async function handleDeleteWorkflow(id: string): Promise<Response> {
  try {
    // Check if workflow exists
    const existing = await db.query.workflows.findFirst({
      where: eq(workflows.id, id),
    });

    if (!existing) {
      return json(
        { ok: false, error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` } },
        404
      );
    }

    await db.delete(workflows).where(eq(workflows.id, id));

    // Return 204 No Content for successful deletion
    return new Response(null, { status: 204, headers: corsHeaders });
  } catch (error) {
    console.error('[Workflows] Delete error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete workflow' } },
      500
    );
  }
}

// CORS headers for dev
const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper to create JSON response
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

// ============ Health Check Handler ============

async function handleHealthCheck(): Promise<Response> {
  const startTime = Date.now();
  const checks: {
    database: { status: 'ok' | 'error'; latencyMs?: number; error?: string };
    github: { status: 'ok' | 'error' | 'not_configured'; login?: string | null };
  } = {
    database: { status: 'error' },
    github: { status: 'not_configured' },
  };

  // Check database connectivity
  try {
    const dbStart = Date.now();
    const result = await db.query.projects.findFirst();
    checks.database = {
      status: 'ok',
      latencyMs: Date.now() - dbStart,
    };
    // Suppress unused variable warning - we just need to verify the query works
    void result;
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error instanceof Error ? error.message : 'Database query failed',
    };
  }

  // Check GitHub token status
  try {
    const tokenResult = await githubService.getTokenInfo();
    if (tokenResult.ok && tokenResult.value) {
      checks.github = {
        status: tokenResult.value.isValid ? 'ok' : 'error',
        login: tokenResult.value.githubLogin,
      };
    } else if (!tokenResult.ok) {
      checks.github = {
        status: 'error',
      };
      console.debug('[Health] GitHub token error:', tokenResult.error.message);
    }
  } catch (error) {
    checks.github = {
      status: 'error',
    };
    console.debug(
      '[Health] GitHub token check failed:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }

  const allOk = checks.database.status === 'ok';

  return json({
    ok: allOk,
    data: {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
      responseTimeMs: Date.now() - startTime,
    },
  });
}

// Route handlers
async function handleGitHubOrgs(): Promise<Response> {
  const result = await githubService.listUserOrgs();
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 401);
  }
  return json({ ok: true, data: { orgs: result.value } });
}

async function handleGitHubReposForOwner(owner: string): Promise<Response> {
  const result = await githubService.listReposForOwner(owner);
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 401);
  }
  return json({ ok: true, data: { repos: result.value } });
}

async function handleGitHubClone(request: Request): Promise<Response> {
  const body = (await request.json()) as { url: string; destination: string };

  if (!body.url || !body.destination) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'URL and destination are required' } },
      400
    );
  }

  // Expand ~ to home directory
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const destination = body.destination.replace(/^~/, homeDir);

  // Get the repo name from URL for the final path
  const repoName = body.url.split('/').pop()?.replace('.git', '') || 'repo';
  const fullPath = `${destination}/${repoName}`;

  try {
    const { existsSync, mkdirSync } = await import('node:fs');

    // Check if target folder already exists - fail if it does
    if (existsSync(fullPath)) {
      return json(
        {
          ok: false,
          error: {
            code: 'FOLDER_EXISTS',
            message: `Folder "${repoName}" already exists at ${destination}`,
          },
        },
        400
      );
    }

    // Create parent destination directory if needed
    if (!existsSync(destination)) {
      mkdirSync(destination, { recursive: true });
    }

    // Get token for private repos
    const token = await githubService.getDecryptedToken();

    // Build clone URL with token for authentication (if available)
    let cloneUrl = body.url;
    if (token && body.url.startsWith('https://github.com/')) {
      // Insert token into URL for authentication
      cloneUrl = body.url.replace('https://github.com/', `https://${token}@github.com/`);
    }

    // Run git clone
    const proc = Bun.spawn(['git', 'clone', cloneUrl, fullPath], {
      cwd: destination,
      stderr: 'pipe',
      stdout: 'pipe',
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error('[Clone] Failed:', stderr);
      return json(
        {
          ok: false,
          error: { code: 'CLONE_FAILED', message: 'Failed to clone repository' },
        },
        500
      );
    }

    return json({ ok: true, data: { path: fullPath } });
  } catch (error) {
    console.error('[Clone] Error:', error);
    return json(
      {
        ok: false,
        error: {
          code: 'CLONE_ERROR',
          message: error instanceof Error ? error.message : 'Clone failed',
        },
      },
      500
    );
  }
}

async function handleGitHubRepos(): Promise<Response> {
  const result = await githubService.listUserRepos();
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 401);
  }
  return json({ ok: true, data: { repos: result.value } });
}

async function handleGitHubTokenInfo(): Promise<Response> {
  const result = await githubService.getTokenInfo();
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 500);
  }
  return json({ ok: true, data: { tokenInfo: result.value } });
}

async function handleGitHubSaveToken(request: Request): Promise<Response> {
  const body = (await request.json()) as { token: string };
  if (!body.token) {
    return json({ ok: false, error: { code: 'MISSING_TOKEN', message: 'Token is required' } }, 400);
  }

  const result = await githubService.saveToken(body.token);
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 400);
  }
  return json({ ok: true, data: { tokenInfo: result.value } });
}

async function handleGitHubDeleteToken(): Promise<Response> {
  const result = await githubService.deleteToken();
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 500);
  }
  return json({ ok: true, data: null });
}

async function handleGitHubRevalidate(): Promise<Response> {
  const result = await githubService.revalidateToken();
  if (!result.ok) {
    return json({ ok: false, error: result.error }, 500);
  }
  return json({ ok: true, data: { isValid: result.value } });
}

// Discover local git repositories
async function handleDiscoverLocalRepos(): Promise<Response> {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  // Common directories to search for git repos
  const searchDirs = [
    `${homeDir}/git`,
    `${homeDir}/projects`,
    `${homeDir}/code`,
    `${homeDir}/Developer`,
    `${homeDir}/repos`,
    `${homeDir}/workspace`,
    `${homeDir}/src`,
  ];

  const { existsSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  type LocalRepo = {
    name: string;
    path: string;
    lastModified: string;
  };

  const repos: LocalRepo[] = [];

  for (const searchDir of searchDirs) {
    if (!existsSync(searchDir)) continue;

    try {
      const entries = readdirSync(searchDir);

      for (const entry of entries) {
        const fullPath = join(searchDir, entry);

        try {
          const stat = statSync(fullPath);
          if (!stat.isDirectory()) continue;

          // Check if it's a git repo
          const gitDir = join(fullPath, '.git');
          if (existsSync(gitDir)) {
            repos.push({
              name: entry,
              path: fullPath,
              lastModified: stat.mtime.toISOString(),
            });
          }
        } catch (error) {
          // Log skipped entries for debugging
          console.debug(
            `[Discover] Skipping ${fullPath}:`,
            error instanceof Error ? error.message : 'access denied'
          );
        }
      }
    } catch (error) {
      // Log unreadable directories for debugging
      console.debug(
        `[Discover] Cannot read ${searchDir}:`,
        error instanceof Error ? error.message : 'access denied'
      );
    }
  }

  // Sort by last modified (most recent first)
  repos.sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime());

  // Limit to 20 most recent
  return json({ ok: true, data: { repos: repos.slice(0, 20) } });
}

// Helper to wait for repo to be ready (has commits)
async function waitForRepoReady(repoFullName: string, maxAttempts = 15): Promise<boolean> {
  const octokit = await githubService.getOctokit();
  if (!octokit) return false;

  const parts = repoFullName.split('/');
  const owner = parts[0];
  const repo = parts[1];

  if (!owner || !repo) {
    console.error('[Template] Invalid repo full name:', repoFullName);
    return false;
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      // Check if repo has any commits
      const { data: commits } = await octokit.rest.repos.listCommits({
        owner,
        repo,
        per_page: 1,
      });

      if (commits.length > 0) {
        console.log(`[Template] Repo ${repoFullName} ready after ${attempt + 1} attempts`);
        return true;
      }
    } catch (error) {
      // 409 means repo is empty (still being created from template)
      // Other errors we should log but continue waiting
      const status = (error as { status?: number }).status;
      if (status !== 409) {
        console.log(`[Template] Waiting for repo... attempt ${attempt + 1}, status: ${status}`);
      }
    }

    // Wait 2 seconds between attempts
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return false;
}

// Create repo from template and clone it
async function handleCreateFromTemplate(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    templateOwner: string;
    templateRepo: string;
    name: string;
    owner?: string;
    description?: string;
    isPrivate?: boolean;
    clonePath: string;
  };

  if (!body.templateOwner || !body.templateRepo || !body.name || !body.clonePath) {
    return json(
      {
        ok: false,
        error: {
          code: 'MISSING_PARAMS',
          message: 'templateOwner, templateRepo, name, and clonePath are required',
        },
      },
      400
    );
  }

  // Step 1: Create the repo from template
  const createResult = await githubService.createRepoFromTemplate({
    templateOwner: body.templateOwner,
    templateRepo: body.templateRepo,
    name: body.name,
    owner: body.owner,
    description: body.description,
    isPrivate: body.isPrivate,
  });

  if (!createResult.ok) {
    return json({ ok: false, error: createResult.error }, 400);
  }

  // Step 2: Wait for the repo to be ready (GitHub needs time to copy template files)
  const fullName = createResult.value?.fullName;
  if (!fullName) {
    return json(
      {
        ok: false,
        error: {
          code: 'INVALID_RESPONSE',
          message: 'GitHub API response missing fullName',
        },
      },
      500
    );
  }

  console.log(`[Template] Waiting for repo ${fullName} to be ready...`);
  const isReady = await waitForRepoReady(fullName);

  if (!isReady) {
    console.error('[Template] Repo not ready after max attempts');
    return json(
      {
        ok: false,
        error: {
          code: 'REPO_NOT_READY',
          message:
            'Repository was created but files are still being copied. Please try cloning manually.',
        },
      },
      500
    );
  }

  // Step 3: Clone the newly created repo
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const destination = body.clonePath.replace(/^~/, homeDir);
  const fullPath = `${destination}/${body.name}`;

  try {
    const { existsSync, mkdirSync } = await import('node:fs');

    if (existsSync(fullPath)) {
      return json(
        {
          ok: false,
          error: {
            code: 'FOLDER_EXISTS',
            message: `Folder "${body.name}" already exists at ${destination}`,
          },
        },
        400
      );
    }

    if (!existsSync(destination)) {
      mkdirSync(destination, { recursive: true });
    }

    const token = await githubService.getDecryptedToken();
    let cloneUrl = createResult.value?.cloneUrl;
    if (!cloneUrl) {
      return json(
        {
          ok: false,
          error: {
            code: 'INVALID_RESPONSE',
            message: 'GitHub API response missing cloneUrl',
          },
        },
        500
      );
    }

    if (token && cloneUrl.startsWith('https://github.com/')) {
      cloneUrl = cloneUrl.replace('https://github.com/', `https://${token}@github.com/`);
    }

    const proc = Bun.spawn(['git', 'clone', cloneUrl, fullPath], {
      cwd: destination,
      stderr: 'pipe',
      stdout: 'pipe',
    });

    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      console.error('[Clone from template] Failed:', stderr);
      return json(
        {
          ok: false,
          error: { code: 'CLONE_FAILED', message: 'Repository created but failed to clone' },
        },
        500
      );
    }

    return json({
      ok: true,
      data: {
        path: fullPath,
        repoFullName: createResult.value.fullName,
        cloneUrl: createResult.value.cloneUrl,
      },
    });
  } catch (error) {
    console.error('[Clone from template] Error:', error);
    return json(
      {
        ok: false,
        error: {
          code: 'CLONE_ERROR',
          message: error instanceof Error ? error.message : 'Clone failed',
        },
      },
      500
    );
  }
}

// ============ Template Handlers ============

async function handleListTemplates(url: URL): Promise<Response> {
  const scope = url.searchParams.get('scope') as 'org' | 'project' | undefined;
  const projectId = url.searchParams.get('projectId') ?? undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  try {
    const result = await templateService.list({ scope, projectId, limit });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
      ok: true,
      data: {
        items: result.value,
        nextCursor: null,
        hasMore: false,
        totalCount: result.value.length,
      },
    });
  } catch (error) {
    console.error('[Templates] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list templates' } },
      500
    );
  }
}

async function handleCreateTemplate(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const result = await templateService.create({
      name: body.name,
      description: body.description,
      scope: body.scope,
      githubUrl: body.githubUrl,
      branch: body.branch,
      configPath: body.configPath,
      projectId: body.projectId,
      projectIds: body.projectIds,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value }, 201);
  } catch (error) {
    console.error('[Templates] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create template' } },
      500
    );
  }
}

async function handleGetTemplate(id: string): Promise<Response> {
  try {
    const result = await templateService.getById(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Templates] Get error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get template' } }, 500);
  }
}

async function handleUpdateTemplate(id: string, request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const result = await templateService.update(id, {
      name: body.name,
      description: body.description,
      branch: body.branch,
      configPath: body.configPath,
      projectIds: body.projectIds,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Templates] Update error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update template' } },
      500
    );
  }
}

async function handleDeleteTemplate(id: string): Promise<Response> {
  try {
    const result = await templateService.delete(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: null });
  } catch (error) {
    console.error('[Templates] Delete error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete template' } },
      500
    );
  }
}

async function handleSyncTemplate(id: string): Promise<Response> {
  try {
    const result = await templateService.sync(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Templates] Sync error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to sync template' } },
      500
    );
  }
}

// ============ Marketplace Handlers ============

async function handleListMarketplaces(url: URL): Promise<Response> {
  try {
    const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
    const includeDisabled = url.searchParams.get('includeDisabled') === 'true';

    const result = await marketplaceService.list({ limit, includeDisabled });
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
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
    });
  } catch (error) {
    console.error('[Marketplaces] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list marketplaces' } },
      500
    );
  }
}

async function handleGetMarketplace(id: string): Promise<Response> {
  try {
    const result = await marketplaceService.getById(id);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    const m = result.value;
    return json({
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
    });
  } catch (error) {
    console.error('[Marketplaces] Get error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get marketplace' } },
      500
    );
  }
}

async function handleCreateMarketplace(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      name: string;
      githubUrl?: string;
      githubOwner?: string;
      githubRepo?: string;
      branch?: string;
      pluginsPath?: string;
    };

    if (!body.name) {
      return json({ ok: false, error: { code: 'MISSING_NAME', message: 'Name is required' } }, 400);
    }

    if (!body.githubUrl && (!body.githubOwner || !body.githubRepo)) {
      return json(
        {
          ok: false,
          error: { code: 'MISSING_REPO', message: 'GitHub URL or owner/repo required' },
        },
        400
      );
    }

    const result = await marketplaceService.create(body);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Marketplaces] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create marketplace' } },
      500
    );
  }
}

async function handleDeleteMarketplace(id: string): Promise<Response> {
  try {
    const result = await marketplaceService.delete(id);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: { deleted: true } });
  } catch (error) {
    console.error('[Marketplaces] Delete error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete marketplace' } },
      500
    );
  }
}

async function handleSyncMarketplace(id: string): Promise<Response> {
  try {
    console.log(`[Marketplaces] Syncing marketplace ${id}`);
    const result = await marketplaceService.sync(id);
    if (!result.ok) {
      console.error(`[Marketplaces] Sync failed for ${id}:`, result.error);
      return json({ ok: false, error: result.error }, result.error.status);
    }

    console.log(`[Marketplaces] Synced ${result.value.pluginCount} plugins for ${id}`);
    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Marketplaces] Sync error:', error);
    return json(
      { ok: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync marketplace' } },
      500
    );
  }
}

async function handleListPlugins(url: URL): Promise<Response> {
  try {
    const search = url.searchParams.get('search') ?? undefined;
    const category = url.searchParams.get('category') ?? undefined;
    const marketplaceId = url.searchParams.get('marketplaceId') ?? undefined;

    const result = await marketplaceService.listAllPlugins({ search, category, marketplaceId });
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
      ok: true,
      data: {
        items: result.value,
        totalCount: result.value.length,
      },
    });
  } catch (error) {
    console.error('[Marketplaces] List plugins error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to list plugins' } }, 500);
  }
}

async function handleGetCategories(): Promise<Response> {
  try {
    const result = await marketplaceService.getCategories();
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
      ok: true,
      data: { categories: result.value },
    });
  } catch (error) {
    console.error('[Marketplaces] Get categories error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get categories' } },
      500
    );
  }
}

async function handleSeedDefaultMarketplace(): Promise<Response> {
  try {
    const result = await marketplaceService.seedDefaultMarketplace();
    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: { seeded: result.value !== null } });
  } catch (error) {
    console.error('[Marketplaces] Seed error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to seed marketplace' } },
      500
    );
  }
}

// ============ Task Handlers ============

async function handleListTasks(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');
  const column = url.searchParams.get('column') as
    | 'backlog'
    | 'queued'
    | 'in_progress'
    | 'waiting_approval'
    | 'verified'
    | undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    const result = await taskService.list(projectId, { column, limit, offset });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
      ok: true,
      data: {
        items: result.value,
        nextCursor: null,
        hasMore: false,
        totalCount: result.value.length,
      },
    });
  } catch (error) {
    console.error('[Tasks] List error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to list tasks' } }, 500);
  }
}

async function handleGetTask(id: string): Promise<Response> {
  try {
    const result = await taskService.getById(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Tasks] Get error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get task' } }, 500);
  }
}

async function handleCreateTask(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      projectId: string;
      title: string;
      description?: string;
      labels?: string[];
      priority?: 'high' | 'medium' | 'low';
    };

    if (!body.projectId || !body.title) {
      return json(
        {
          ok: false,
          error: { code: 'MISSING_PARAMS', message: 'projectId and title are required' },
        },
        400
      );
    }

    const result = await taskService.create({
      projectId: body.projectId,
      title: body.title,
      description: body.description,
      labels: body.labels,
      priority: body.priority,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value }, 201);
  } catch (error) {
    console.error('[Tasks] Create error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to create task' } }, 500);
  }
}

async function handleUpdateTask(id: string, request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      title?: string;
      description?: string;
      labels?: string[];
      priority?: 'high' | 'medium' | 'low';
    };

    const result = await taskService.update(id, {
      title: body.title,
      description: body.description,
      labels: body.labels,
      priority: body.priority,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Tasks] Update error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to update task' } }, 500);
  }
}

async function handleDeleteTask(id: string): Promise<Response> {
  try {
    const result = await taskService.delete(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: null });
  } catch (error) {
    console.error('[Tasks] Delete error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete task' } }, 500);
  }
}

// ============ API Key Handlers ============

async function handleGetApiKey(service: string): Promise<Response> {
  const result = await apiKeyService.getKeyInfo(service);

  if (!result.ok) {
    return json({ ok: false, error: result.error }, 500);
  }

  return json({ ok: true, data: { keyInfo: result.value } });
}

async function handleSaveApiKey(service: string, request: Request): Promise<Response> {
  const body = (await request.json()) as { key: string };

  if (!body.key) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'API key is required' } },
      400
    );
  }

  const result = await apiKeyService.saveKey(service, body.key);

  if (!result.ok) {
    return json({ ok: false, error: result.error }, 400);
  }

  return json({ ok: true, data: { keyInfo: result.value } });
}

async function handleDeleteApiKey(service: string): Promise<Response> {
  const result = await apiKeyService.deleteKey(service);

  if (!result.ok) {
    return json({ ok: false, error: result.error }, 500);
  }

  return json({ ok: true, data: null });
}

// ============ Sandbox Config Handlers ============

async function handleListSandboxConfigs(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await sandboxConfigService.list({ limit, offset });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({
      ok: true,
      data: {
        items: result.value,
        totalCount: result.value.length,
      },
    });
  } catch (error) {
    console.error('[SandboxConfigs] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list sandbox configs' } },
      500
    );
  }
}

async function handleCreateSandboxConfig(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      name: string;
      description?: string;
      isDefault?: boolean;
      baseImage?: string;
      memoryMb?: number;
      cpuCores?: number;
      maxProcesses?: number;
      timeoutMinutes?: number;
    };

    if (!body.name) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'Name is required' } },
        400
      );
    }

    const result = await sandboxConfigService.create({
      name: body.name,
      description: body.description,
      isDefault: body.isDefault,
      baseImage: body.baseImage,
      memoryMb: body.memoryMb,
      cpuCores: body.cpuCores,
      maxProcesses: body.maxProcesses,
      timeoutMinutes: body.timeoutMinutes,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value }, 201);
  } catch (error) {
    console.error('[SandboxConfigs] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create sandbox config' } },
      500
    );
  }
}

async function handleGetSandboxConfig(id: string): Promise<Response> {
  try {
    const result = await sandboxConfigService.getById(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[SandboxConfigs] Get error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get sandbox config' } },
      500
    );
  }
}

async function handleUpdateSandboxConfig(id: string, request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      name?: string;
      description?: string;
      isDefault?: boolean;
      baseImage?: string;
      memoryMb?: number;
      cpuCores?: number;
      maxProcesses?: number;
      timeoutMinutes?: number;
    };

    const result = await sandboxConfigService.update(id, {
      name: body.name,
      description: body.description,
      isDefault: body.isDefault,
      baseImage: body.baseImage,
      memoryMb: body.memoryMb,
      cpuCores: body.cpuCores,
      maxProcesses: body.maxProcesses,
      timeoutMinutes: body.timeoutMinutes,
    });

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[SandboxConfigs] Update error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update sandbox config' } },
      500
    );
  }
}

async function handleDeleteSandboxConfig(id: string): Promise<Response> {
  try {
    const result = await sandboxConfigService.delete(id);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, result.error.status);
    }

    return json({ ok: true, data: null });
  } catch (error) {
    console.error('[SandboxConfigs] Delete error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete sandbox config' } },
      500
    );
  }
}

// ============ Kubernetes API Handlers ============

/**
 * Handle GET /api/sandbox/k8s/status
 * Returns K8s cluster health and connection status
 */
async function handleK8sStatus(url: URL): Promise<Response> {
  const kubeconfigPath = url.searchParams.get('kubeconfigPath') || undefined;
  const context = url.searchParams.get('context') || undefined;

  try {
    // Load kubeconfig
    const kc = loadKubeConfig(kubeconfigPath, true); // skipTLSVerify for local dev

    // Resolve context if specified
    if (context) {
      resolveContext(kc, context);
    }

    // Get cluster info
    const clusterInfo = getClusterInfo(kc);
    const currentContext = kc.getCurrentContext();

    // Try to connect to the cluster
    const k8s = await import('@kubernetes/client-node');
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);

    // Get server version using Node.js https module (bypasses Bun's TLS issues)
    let serverVersion = 'unknown';
    try {
      const cluster = kc.getCurrentCluster();
      if (cluster?.server) {
        const https = await import('node:https');
        const { URL } = await import('node:url');
        const versionUrl = new URL('/version', cluster.server);

        const versionData = await new Promise<{ gitVersion?: string; major?: string; minor?: string }>((resolve, reject) => {
          const req = https.request(
            versionUrl,
            {
              method: 'GET',
              rejectUnauthorized: false, // Skip TLS verification for local dev
            },
            (res) => {
              let data = '';
              res.on('data', (chunk) => (data += chunk));
              res.on('end', () => {
                try {
                  resolve(JSON.parse(data));
                } catch {
                  reject(new Error('Invalid JSON response'));
                }
              });
            }
          );
          req.on('error', reject);
          req.end();
        });

        serverVersion = versionData.gitVersion || `v${versionData.major}.${versionData.minor}`;
      }
    } catch (versionError) {
      // Version API may fail - this is non-critical
      console.debug('[K8s Status] Version fetch failed:', versionError instanceof Error ? versionError.message : versionError);
    }

    // Check namespace
    const namespace = K8S_PROVIDER_DEFAULTS.namespace;
    let namespaceExists = false;
    let pods = 0;
    let podsRunning = 0;

    try {
      await coreApi.readNamespace({ name: namespace });
      namespaceExists = true;

      // Count pods in namespace
      const podList = await coreApi.listNamespacedPod({ namespace });
      pods = podList.items.length;
      podsRunning = podList.items.filter(
        (p) => p.status?.phase === 'Running'
      ).length;
    } catch {
      // Namespace doesn't exist yet
    }

    return json({
      ok: true,
      data: {
        healthy: true,
        context: currentContext,
        cluster: clusterInfo?.name,
        server: clusterInfo?.server,
        serverVersion,
        namespace,
        namespaceExists,
        pods,
        podsRunning,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to connect to cluster';
    console.error('[K8s Status] Error:', message);
    return json({
      ok: true,
      data: {
        healthy: false,
        message,
      },
    });
  }
}

/**
 * Handle GET /api/sandbox/k8s/contexts
 * Returns list of available K8s contexts
 */
async function handleK8sContexts(url: URL): Promise<Response> {
  const kubeconfigPath = url.searchParams.get('kubeconfigPath') || undefined;

  try {
    const kc = loadKubeConfig(kubeconfigPath);
    const contexts = kc.getContexts();
    const currentContext = kc.getCurrentContext();

    return json({
      ok: true,
      data: {
        contexts: contexts.map((ctx) => ({
          name: ctx.name,
          cluster: ctx.cluster,
          user: ctx.user,
          namespace: ctx.namespace,
        })),
        current: currentContext,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load kubeconfig';
    console.error('[K8s Contexts] Error:', message);
    return json(
      {
        ok: false,
        error: { code: 'K8S_CONFIG_ERROR', message },
      },
      400
    );
  }
}

/**
 * Handle GET /api/sandbox/k8s/namespaces
 * Returns list of available K8s namespaces
 */
async function handleK8sNamespaces(url: URL): Promise<Response> {
  const kubeconfigPath = url.searchParams.get('kubeconfigPath') || undefined;
  const context = url.searchParams.get('context') || undefined;
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  try {
    const kc = loadKubeConfig(kubeconfigPath, true); // skipTLSVerify for local dev

    if (context) {
      resolveContext(kc, context);
    }

    const k8s = await import('@kubernetes/client-node');
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);

    const namespaceList = await coreApi.listNamespace({ limit });

    return json({
      ok: true,
      data: {
        namespaces: namespaceList.items.map((ns) => ({
          name: ns.metadata?.name,
          status: ns.status?.phase,
          createdAt: ns.metadata?.creationTimestamp,
        })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list namespaces';
    console.error('[K8s Namespaces] Error:', message);
    return json(
      {
        ok: false,
        error: { code: 'K8S_API_ERROR', message },
      },
      500
    );
  }
}

// ============ Task Creation with AI Handlers ============

// Store active SSE connections for streaming
const sseConnections = new Map<string, ReadableStreamDefaultController<Uint8Array>>();

async function handleTaskCreationStart(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'projectId is required' } },
        400
      );
    }

    const result = await taskCreationService.startConversation(projectId);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    return json({ ok: true, data: { sessionId: result.value.id } });
  } catch (error) {
    console.error('[TaskCreation] Start error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to start conversation' } },
      500
    );
  }
}

async function handleTaskCreationMessage(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId, message } = body as { sessionId: string; message: string };

    if (!sessionId || !message) {
      return json(
        {
          ok: false,
          error: { code: 'INVALID_INPUT', message: 'sessionId and message are required' },
        },
        400
      );
    }

    // Send message with token streaming to SSE
    const controller = sseConnections.get(sessionId);
    const onToken = controller
      ? (delta: string, accumulated: string) => {
          const data = JSON.stringify({
            type: 'task-creation:token',
            data: { delta, accumulated },
          });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
      : undefined;

    const result = await taskCreationService.sendMessage(sessionId, message, onToken);

    if (!result.ok) {
      // Send error to SSE if connected
      if (controller) {
        const errorData = JSON.stringify({
          type: 'task-creation:error',
          data: { error: result.error.message },
        });
        controller.enqueue(new TextEncoder().encode(`data: ${errorData}\n\n`));
      }
      return json({ ok: false, error: result.error }, 400);
    }

    // Send message completion to SSE
    if (controller) {
      const session = result.value;
      const lastMessage = session.messages[session.messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const msgData = JSON.stringify({
          type: 'task-creation:message',
          data: { messageId: lastMessage.id, role: lastMessage.role, content: lastMessage.content },
        });
        controller.enqueue(new TextEncoder().encode(`data: ${msgData}\n\n`));
      }
      // Send suggestion if available
      if (session.suggestion) {
        const suggestionData = JSON.stringify({
          type: 'task-creation:suggestion',
          data: { suggestion: session.suggestion },
        });
        controller.enqueue(new TextEncoder().encode(`data: ${suggestionData}\n\n`));
      }
    }

    return json({ ok: true, data: { messageId: 'msg-sent' } });
  } catch (error) {
    console.error('[TaskCreation] Message error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to send message' } },
      500
    );
  }
}

async function handleTaskCreationAccept(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId, overrides } = body as {
      sessionId: string;
      overrides?: Record<string, unknown>;
    };

    if (!sessionId) {
      return json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } },
        400
      );
    }

    const result = await taskCreationService.acceptSuggestion(sessionId, overrides);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    // Send completion to SSE
    const controller = sseConnections.get(sessionId);
    if (controller) {
      const completeData = JSON.stringify({
        type: 'task-creation:completed',
        data: { taskId: result.value.taskId },
      });
      controller.enqueue(new TextEncoder().encode(`data: ${completeData}\n\n`));
    }

    return json({
      ok: true,
      data: { taskId: result.value.taskId, sessionId, status: 'completed' },
    });
  } catch (error) {
    console.error('[TaskCreation] Accept error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to accept suggestion' } },
      500
    );
  }
}

async function handleTaskCreationCancel(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return json(
        { ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } },
        400
      );
    }

    const result = await taskCreationService.cancel(sessionId);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    // Close SSE connection
    const controller = sseConnections.get(sessionId);
    if (controller) {
      const cancelData = JSON.stringify({ type: 'task-creation:cancelled', data: { sessionId } });
      controller.enqueue(new TextEncoder().encode(`data: ${cancelData}\n\n`));
      controller.close();
      sseConnections.delete(sessionId);
    }

    return json({ ok: true, data: { sessionId, status: 'cancelled' } });
  } catch (error) {
    console.error('[TaskCreation] Cancel error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to cancel session' } },
      500
    );
  }
}

// ============ Session Handlers ============

async function handleListSessions(url: URL): Promise<Response> {
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

  try {
    const result = await sessionService.list({ limit, offset });
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    return json({
      ok: true,
      data: result.value,
      pagination: {
        limit,
        offset,
        hasMore: result.value.length === limit,
      },
    });
  } catch (error) {
    console.error('[Sessions] List error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to list sessions' } },
      500
    );
  }
}

async function handleGetSession(id: string): Promise<Response> {
  try {
    const result = await sessionService.getById(id);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 404);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Sessions] Get error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session' } },
      500
    );
  }
}

async function handleGetSessionEvents(id: string, url: URL): Promise<Response> {
  try {
    const limit = parseInt(url.searchParams.get('limit') ?? '100', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

    const result = await sessionService.getEventsBySession(id, { limit, offset });
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 404);
    }

    return json({
      ok: true,
      data: result.value,
      pagination: { total: result.value.length, limit, offset },
    });
  } catch (error) {
    console.error('[Sessions] Get events error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session events' } },
      500
    );
  }
}

async function handleGetSessionSummary(id: string): Promise<Response> {
  try {
    const result = await sessionService.getSessionSummary(id);
    if (!result.ok) {
      return json({ ok: false, error: result.error }, 404);
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

    return json({ ok: true, data: summary });
  } catch (error) {
    console.error('[Sessions] Get summary error:', error);
    return json(
      { ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to get session summary' } },
      500
    );
  }
}

// ============ Worktree Handlers ============

async function handleListWorktrees(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    const result = await worktreeService.list(projectId);

    if (!result.ok) {
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list worktrees' } },
        500
      );
    }

    return json({ ok: true, data: { items: result.value } });
  } catch (error) {
    console.error('[Worktrees] List error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list worktrees' } },
      500
    );
  }
}

async function handleGetWorktree(id: string): Promise<Response> {
  try {
    const result = await worktreeService.getStatus(id);

    if (!result.ok) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Worktree not found' } }, 404);
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Worktrees] Get error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get worktree' } }, 500);
  }
}

async function handleCreateWorktree(request: Request): Promise<Response> {
  const body = (await request.json()) as {
    projectId: string;
    taskId: string;
    baseBranch?: string;
  };

  if (!body.projectId || !body.taskId) {
    return json(
      {
        ok: false,
        error: { code: 'MISSING_PARAMS', message: 'projectId and taskId are required' },
      },
      400
    );
  }

  try {
    const result = await worktreeService.create({
      projectId: body.projectId,
      taskId: body.taskId,
      baseBranch: body.baseBranch,
    });

    if (!result.ok) {
      console.error('[Worktrees] Create failed:', result.error);
      return json(
        { ok: false, error: { code: result.error.code, message: result.error.message } },
        400
      );
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Worktrees] Create error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create worktree' } },
      500
    );
  }
}

async function handleRemoveWorktree(id: string, url: URL): Promise<Response> {
  const force = url.searchParams.get('force') === 'true';

  try {
    const result = await worktreeService.remove(id, force);

    if (!result.ok) {
      console.error('[Worktrees] Remove failed:', result.error);
      return json(
        { ok: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    }

    return json({ ok: true, data: null });
  } catch (error) {
    console.error('[Worktrees] Remove error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to remove worktree' } },
      500
    );
  }
}

async function handleCommitWorktree(id: string, request: Request): Promise<Response> {
  const body = (await request.json()) as { message: string };

  if (!body.message) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'message is required' } },
      400
    );
  }

  try {
    const result = await worktreeService.commit(id, body.message);

    if (!result.ok) {
      console.error('[Worktrees] Commit failed:', result.error);
      return json(
        { ok: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    }

    return json({ ok: true, data: { sha: result.value } });
  } catch (error) {
    console.error('[Worktrees] Commit error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to commit changes' } },
      500
    );
  }
}

async function handleMergeWorktree(id: string, request: Request): Promise<Response> {
  const body = (await request.json()) as {
    targetBranch?: string;
    deleteAfterMerge?: boolean;
    squash?: boolean;
    commitMessage?: string;
  };

  try {
    const result = await worktreeService.merge(id, body.targetBranch);

    if (!result.ok) {
      console.error('[Worktrees] Merge failed:', result.error);
      // Check for merge conflict
      if (result.error.code === 'MERGE_CONFLICT') {
        return json(
          {
            ok: false,
            error: { code: 'MERGE_CONFLICT', message: result.error.message },
            conflicts: result.error.details?.files ?? [],
          },
          409
        );
      }
      return json(
        { ok: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    }

    // If deleteAfterMerge is requested, remove the worktree
    if (body.deleteAfterMerge) {
      const removeResult = await worktreeService.remove(id, true);
      if (!removeResult.ok) {
        console.error('[Worktrees] Post-merge cleanup failed:', removeResult.error);
        // Return success for merge but indicate cleanup failed
        return json({
          ok: true,
          data: { merged: true, cleanupFailed: true, cleanupError: removeResult.error.message },
        });
      }
    }

    return json({ ok: true, data: { merged: true } });
  } catch (error) {
    console.error('[Worktrees] Merge error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to merge worktree' } },
      500
    );
  }
}

async function handleGetWorktreeDiff(id: string): Promise<Response> {
  try {
    const result = await worktreeService.getDiff(id);

    if (!result.ok) {
      console.error('[Worktrees] Diff failed:', result.error);
      return json(
        { ok: false, error: { code: result.error.code, message: result.error.message } },
        result.error.code === 'NOT_FOUND' ? 404 : 400
      );
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Worktrees] Diff error:', error);
    return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get diff' } }, 500);
  }
}

async function handlePruneWorktrees(request: Request): Promise<Response> {
  const body = (await request.json()) as { projectId?: string };
  const projectId = body.projectId;

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    const result = await worktreeService.prune(projectId);

    if (!result.ok) {
      console.error('[Worktrees] Prune failed:', result.error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to prune worktrees' } },
        500
      );
    }

    return json({ ok: true, data: result.value });
  } catch (error) {
    console.error('[Worktrees] Prune error:', error);
    return json(
      { ok: false, error: { code: 'DB_ERROR', message: 'Failed to prune worktrees' } },
      500
    );
  }
}

// ============ Git View Handlers ============

async function handleGetGitStatus(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    // Get project to find the path
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Get current branch
    const { stdout: branchOutput } = await bunCommandRunner.exec(
      'git rev-parse --abbrev-ref HEAD',
      project.path
    );
    const currentBranch = branchOutput.trim();

    // Get repo name from path
    const repoName = project.path.split('/').pop() || project.name;

    // Get git status (porcelain format for easy parsing)
    const { stdout: statusOutput } = await bunCommandRunner.exec(
      'git status --porcelain',
      project.path
    );

    const statusLines = statusOutput
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    const staged = statusLines.filter((line) => /^[MADRC]/.test(line)).length;
    const unstaged = statusLines.filter((line) => /^.[MADRC]/.test(line)).length;
    const untracked = statusLines.filter((line) => line.startsWith('??')).length;
    const hasChanges = statusLines.length > 0;

    // Get ahead/behind info
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: aheadBehind } = await bunCommandRunner.exec(
        `git rev-list --left-right --count HEAD...@{upstream} 2>/dev/null || echo "0	0"`,
        project.path
      );
      const [aheadStr, behindStr] = aheadBehind.trim().split(/\s+/);
      ahead = parseInt(aheadStr || '0', 10) || 0;
      behind = parseInt(behindStr || '0', 10) || 0;
    } catch {
      // No upstream, ignore
    }

    return json({
      ok: true,
      data: {
        repoName,
        currentBranch,
        status: hasChanges ? 'dirty' : 'clean',
        staged,
        unstaged,
        untracked,
        ahead,
        behind,
      },
    });
  } catch (error) {
    console.error('[Git] Get status error:', error);
    return json(
      { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to get git status' } },
      500
    );
  }
}

async function handleListGitBranches(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    // Get project to find the path
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Get current HEAD branch
    const { stdout: headOutput } = await bunCommandRunner.exec(
      'git rev-parse --abbrev-ref HEAD',
      project.path
    );
    const currentBranch = headOutput.trim();

    // Get all local branches with their commit info
    // Format: refname:short, objectname, objectname:short, upstream:track
    const { stdout: branchOutput } = await bunCommandRunner.exec(
      'git for-each-ref --format="%(refname:short)|%(objectname)|%(objectname:short)|%(upstream:track)" refs/heads/',
      project.path
    );

    const branches = await Promise.all(
      branchOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map(async (line) => {
          const [name, commitHash, shortHash, trackInfo] = line.split('|');
          if (!name || !commitHash) return null;

          // Get commit count (commits ahead of main/master)
          let commitCount = 0;
          try {
            // Try to count commits ahead of main, fallback to master
            const { stdout: countOutput } = await bunCommandRunner.exec(
              `git rev-list --count main..${name} 2>/dev/null || git rev-list --count master..${name} 2>/dev/null || echo "0"`,
              project.path
            );
            commitCount = parseInt(countOutput.trim(), 10) || 0;
          } catch {
            // Ignore errors, keep count at 0
          }

          // Parse tracking status
          let status: 'ahead' | 'behind' | 'diverged' | 'up-to-date' | 'no-upstream' =
            'no-upstream';
          if (trackInfo) {
            if (trackInfo.includes('ahead') && trackInfo.includes('behind')) {
              status = 'diverged';
            } else if (trackInfo.includes('ahead')) {
              status = 'ahead';
            } else if (trackInfo.includes('behind')) {
              status = 'behind';
            } else if (trackInfo === '') {
              status = 'up-to-date';
            }
          }

          return {
            name: name || '',
            commitHash: commitHash || '',
            shortHash: shortHash || '',
            commitCount,
            isHead: name === currentBranch,
            status,
          };
        })
    );

    // Filter out nulls and sort by isHead first, then by name
    const validBranches = branches
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => {
        if (a.isHead && !b.isHead) return -1;
        if (!a.isHead && b.isHead) return 1;
        return a.name.localeCompare(b.name);
      });

    return json({ ok: true, data: { items: validBranches } });
  } catch (error) {
    console.error('[Git] List branches error:', error);
    return json(
      { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list branches' } },
      500
    );
  }
}

async function handleListGitCommits(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');
  const branch = url.searchParams.get('branch');
  const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    // Get project to find the path
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Default to current branch if not specified
    const targetBranch = branch || 'HEAD';

    // Get commit log with format: hash|short|subject|author|date
    // Using %x00 as delimiter for safety
    const { stdout: logOutput } = await bunCommandRunner.exec(
      `git log ${targetBranch} --format="%H|%h|%s|%an|%aI" -n ${limit}`,
      project.path
    );

    const commits = await Promise.all(
      logOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map(async (line) => {
          const parts = line.split('|');
          const hash = parts[0] || '';
          const shortHash = parts[1] || '';
          const message = parts[2] || '';
          const author = parts[3] || '';
          const date = parts[4] || '';

          // Get file stats for each commit (additions, deletions, files changed)
          let additions: number | undefined;
          let deletions: number | undefined;
          let filesChanged: number | undefined;

          try {
            const { stdout: statsOutput } = await bunCommandRunner.exec(
              `git show ${hash} --stat --format="" | tail -1`,
              project.path
            );
            // Parse stats like: "3 files changed, 10 insertions(+), 5 deletions(-)"
            const statsLine = statsOutput.trim();
            const filesMatch = statsLine.match(/(\d+) files? changed/);
            const insertionsMatch = statsLine.match(/(\d+) insertions?\(\+\)/);
            const deletionsMatch = statsLine.match(/(\d+) deletions?\(-\)/);

            if (filesMatch) filesChanged = parseInt(filesMatch[1] || '0', 10);
            if (insertionsMatch) additions = parseInt(insertionsMatch[1] || '0', 10);
            if (deletionsMatch) deletions = parseInt(deletionsMatch[1] || '0', 10);
          } catch {
            // Stats are optional, ignore errors
          }

          return {
            hash,
            shortHash,
            message,
            author,
            date,
            ...(additions !== undefined && { additions }),
            ...(deletions !== undefined && { deletions }),
            ...(filesChanged !== undefined && { filesChanged }),
          };
        })
    );

    return json({ ok: true, data: { items: commits } });
  } catch (error) {
    console.error('[Git] List commits error:', error);
    return json(
      { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list commits' } },
      500
    );
  }
}

async function handleListGitRemoteBranches(url: URL): Promise<Response> {
  const projectId = url.searchParams.get('projectId');

  if (!projectId) {
    return json(
      { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
      400
    );
  }

  try {
    // Get project to find the path
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    });

    if (!project) {
      return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Project not found' } }, 404);
    }

    // Fetch latest from remote (don't fail if offline)
    try {
      await bunCommandRunner.exec('git fetch --prune 2>/dev/null || true', project.path);
    } catch {
      // Ignore fetch errors (might be offline)
    }

    // Get all remote branches with their commit info
    const { stdout: branchOutput } = await bunCommandRunner.exec(
      'git for-each-ref --format="%(refname:short)|%(objectname)|%(objectname:short)" refs/remotes/',
      project.path
    );

    const branches = await Promise.all(
      branchOutput
        .trim()
        .split('\n')
        .filter((line) => line.trim())
        .map(async (line) => {
          const [fullName, commitHash, shortHash] = line.split('|');
          if (!fullName || !commitHash) return null;

          // Skip HEAD pointer (with refname:short, origin/HEAD becomes just "origin")
          if (fullName.endsWith('/HEAD')) return null;

          // Skip entries without a slash (these are symbolic refs like origin/HEAD shown as "origin")
          if (!fullName.includes('/')) return null;

          // Remove remote prefix (e.g., "origin/main" -> "main")
          const name = fullName.replace(/^[^/]+\//, '');

          // Get commit count from main/master
          let commitCount = 0;
          try {
            const { stdout: countOutput } = await bunCommandRunner.exec(
              `git rev-list --count main..${fullName} 2>/dev/null || git rev-list --count master..${fullName} 2>/dev/null || echo "0"`,
              project.path
            );
            commitCount = parseInt(countOutput.trim(), 10) || 0;
          } catch {
            // Ignore errors, keep count at 0
          }

          return {
            name,
            fullName: fullName || '',
            commitHash: commitHash || '',
            shortHash: shortHash || '',
            commitCount,
          };
        })
    );

    // Filter out nulls and sort by name
    const validBranches = branches
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => a.name.localeCompare(b.name));

    return json({ ok: true, data: { items: validBranches } });
  } catch (error) {
    console.error('[Git] List remote branches error:', error);
    return json(
      { ok: false, error: { code: 'GIT_ERROR', message: 'Failed to list remote branches' } },
      500
    );
  }
}

// ============ Task Creation Stream Handler ============

function handleTaskCreationStream(url: URL): Response {
  const sessionId = url.searchParams.get('sessionId');
  console.log('[TaskCreation Stream] Request for sessionId:', sessionId);

  if (!sessionId) {
    console.log('[TaskCreation Stream] No sessionId provided');
    return json(
      { ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } },
      400
    );
  }

  // Verify session exists
  const session = taskCreationService.getSession(sessionId);
  console.log('[TaskCreation Stream] Session lookup result:', session ? 'found' : 'not found');
  if (!session) {
    console.log('[TaskCreation Stream] Session not found, returning 404');
    return json(
      { ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } },
      404
    );
  }

  // Create SSE stream with keep-alive
  let pingInterval: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Store controller for this session
      sseConnections.set(sessionId, controller);

      // Send initial connected event (using 'connected' type as expected by the frontend hook)
      const connectedData = JSON.stringify({ type: 'connected', sessionId });
      controller.enqueue(new TextEncoder().encode(`data: ${connectedData}\n\n`));

      // Send immediate ping to keep connection alive
      controller.enqueue(new TextEncoder().encode(`: ping\n\n`));

      // Send keep-alive ping every 5 seconds to prevent connection timeout
      pingInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(`: ping\n\n`));
        } catch {
          // Controller may be closed, clear interval
          if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
          }
        }
      }, 5000);
    },
    cancel() {
      if (pingInterval) {
        clearInterval(pingInterval);
        pingInterval = null;
      }
      sseConnections.delete(sessionId);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      ...corsHeaders,
    },
  });
}

// =============================================================================
// Workflow Designer Handlers
// =============================================================================

const WORKFLOW_AI_MODEL = process.env.WORKFLOW_AI_MODEL ?? 'claude-sonnet-4-20250514';

// Request schema for workflow analysis
const analyzeWorkflowRequestSchema = z
  .object({
    templateId: z.string().optional(),
    skills: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
        })
      )
      .optional(),
    commands: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
        })
      )
      .optional(),
    agents: z
      .array(
        z.object({
          name: z.string(),
          description: z.string().optional(),
          content: z.string(),
        })
      )
      .optional(),
    name: z.string().optional(),
  })
  .refine(
    (data) =>
      data.templateId ||
      (data.skills && data.skills.length > 0) ||
      (data.commands && data.commands.length > 0) ||
      (data.agents && data.agents.length > 0),
    {
      message: 'Either templateId or at least one of skills, commands, or agents must be provided',
    }
  );

// AI Response schema
const aiWorkflowResponseSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  aiGenerated: z.boolean().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
});

/**
 * Builds the template content string from skills, commands, and agents
 */
function buildTemplateContent(
  skills: CachedSkill[],
  commands: CachedCommand[],
  agents: CachedAgent[]
): string {
  const sections: string[] = [];

  if (skills.length > 0) {
    sections.push('## Skills\n');
    for (const skill of skills) {
      sections.push(`### ${skill.name}`);
      if (skill.description) {
        sections.push(skill.description);
      }
      sections.push(`\`\`\`\n${skill.content}\n\`\`\`\n`);
    }
  }

  if (commands.length > 0) {
    sections.push('## Commands\n');
    for (const command of commands) {
      sections.push(`### ${command.name}`);
      if (command.description) {
        sections.push(command.description);
      }
      sections.push(`\`\`\`\n${command.content}\n\`\`\`\n`);
    }
  }

  if (agents.length > 0) {
    sections.push('## Agents\n');
    for (const agent of agents) {
      sections.push(`### ${agent.name}`);
      if (agent.description) {
        sections.push(agent.description);
      }
      sections.push(`\`\`\`\n${agent.content}\n\`\`\`\n`);
    }
  }

  return sections.join('\n');
}

/**
 * Parses and validates the AI response into workflow nodes and edges
 */
function parseAIResponse(responseText: string): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  aiConfidence: number;
} {
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = responseText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON in AI response: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Validate basic structure
  const validated = aiWorkflowResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid workflow structure: ${validated.error.message}`);
  }

  // Parse and validate individual nodes
  const nodes: WorkflowNode[] = [];
  for (const nodeData of validated.data.nodes) {
    const nodeResult = workflowNodeSchema.safeParse(nodeData);
    if (nodeResult.success) {
      nodes.push(nodeResult.data);
    } else {
      // Log warning but continue - AI might generate slightly malformed nodes
      console.warn('[workflow-analyze] Skipping invalid node:', nodeResult.error.message, nodeData);
    }
  }

  // Parse and validate individual edges
  const edges: WorkflowEdge[] = [];
  for (const edgeData of validated.data.edges) {
    const edgeResult = workflowEdgeSchema.safeParse(edgeData);
    if (edgeResult.success) {
      edges.push(edgeResult.data);
    } else {
      // Log warning but continue
      console.warn('[workflow-analyze] Skipping invalid edge:', edgeResult.error.message, edgeData);
    }
  }

  // Ensure we have at least start and end nodes
  if (nodes.length === 0) {
    throw new Error('AI generated no valid nodes');
  }

  const hasStart = nodes.some((n) => n.type === 'start');
  const hasEnd = nodes.some((n) => n.type === 'end');

  // Auto-generate start/end nodes if missing (AI sometimes omits them)
  if (!hasStart) {
    console.warn('[workflow-analyze] AI did not generate start node, adding one');
    const firstNode = nodes[0];
    nodes.unshift({
      id: `start-${createId().slice(0, 8)}`,
      type: 'start',
      label: 'Start',
      position: { x: 0, y: 0 },
      inputs: [],
    });
    // Add edge from new start to first node
    const startNode = nodes[0];
    if (firstNode && startNode) {
      edges.unshift({
        id: `edge-start-${createId().slice(0, 8)}`,
        type: 'sequential',
        sourceNodeId: startNode.id,
        targetNodeId: firstNode.id,
      });
    }
  }

  if (!hasEnd) {
    console.warn('[workflow-analyze] AI did not generate end node, adding one');
    const lastNode = nodes[nodes.length - 1];
    const newEndNode = {
      id: `end-${createId().slice(0, 8)}`,
      type: 'end' as const,
      label: 'End',
      position: { x: 0, y: 0 },
      outputs: [],
    };
    nodes.push(newEndNode);
    // Add edge from last node to new end
    if (lastNode && lastNode.type !== 'start') {
      edges.push({
        id: `edge-end-${createId().slice(0, 8)}`,
        type: 'sequential',
        sourceNodeId: lastNode.id,
        targetNodeId: newEndNode.id,
      });
    }
  }

  return {
    nodes,
    edges,
    aiConfidence: validated.data.aiConfidence ?? 0.5,
  };
}

/**
 * Handler for POST /api/workflow-designer/analyze
 */
async function handleWorkflowAnalyze(request: Request): Promise<Response> {
  // Parse request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
      400
    );
  }

  // Validate request
  const parseResult = analyzeWorkflowRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return json(
      {
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: parseResult.error.message },
      },
      400
    );
  }

  const { templateId, skills, commands, agents: agentsData, name } = parseResult.data;

  // Gather template data
  let templateSkills: CachedSkill[] = (skills as CachedSkill[]) ?? [];
  let templateCommands: CachedCommand[] = (commands as CachedCommand[]) ?? [];
  let templateAgents: CachedAgent[] = (agentsData as CachedAgent[]) ?? [];
  let templateName = name ?? 'Generated Workflow';
  let templateDescription: string | undefined;

  // If templateId provided, fetch template from database
  if (templateId) {
    const templateResult = await templateService.getById(templateId);
    if (!templateResult.ok) {
      return json(
        { ok: false, error: { code: 'TEMPLATE_NOT_FOUND', message: 'Template not found' } },
        404
      );
    }

    const template = templateResult.value;
    templateName = template.name;
    templateDescription = template.description ?? undefined;
    templateSkills = template.cachedSkills ?? [];
    templateCommands = template.cachedCommands ?? [];
    templateAgents = template.cachedAgents ?? [];
  }

  // Ensure we have content to analyze
  if (templateSkills.length === 0 && templateCommands.length === 0 && templateAgents.length === 0) {
    return json(
      {
        ok: false,
        error: {
          code: 'WORKFLOW_NO_CONTENT',
          message:
            'No template content provided. Provide either templateId or skills/commands/agents data.',
        },
      },
      400
    );
  }

  // Build template content and prompt
  const templateContent = buildTemplateContent(templateSkills, templateCommands, templateAgents);

  const userPrompt = createWorkflowAnalysisPrompt({
    name: templateName,
    description: templateDescription,
    content: templateContent,
    skills: templateSkills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
    commands: templateCommands.map((c) => ({
      name: c.name,
      command: c.content,
      description: c.description,
    })),
    agents: templateAgents.map((a) => ({
      id: a.name, // Use name as id since CachedAgent doesn't have id
      name: a.name,
      description: a.description,
      systemPrompt: a.content,
    })),
  });

  // Use Claude Agent SDK (same as task creation) - automatically reads ANTHROPIC_API_KEY env var
  let aiResponse: string;
  try {
    // Build full prompt with system context
    const fullPrompt = `${WORKFLOW_GENERATION_SYSTEM_PROMPT}\n\n---\n\n${userPrompt}`;

    // Use shared agentQuery utility
    const result = await agentQuery(fullPrompt, { model: WORKFLOW_AI_MODEL });
    aiResponse = result.text;

    if (!aiResponse) {
      return json(
        {
          ok: false,
          error: { code: 'WORKFLOW_AI_GENERATION_FAILED', message: 'Empty response from AI' },
        },
        500
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[workflow-analyze] Agent SDK error:', message);

    // Check for authentication errors
    if (
      message.includes('401') ||
      message.includes('authentication_error') ||
      message.includes('invalid x-api-key') ||
      message.includes('ANTHROPIC_API_KEY')
    ) {
      return json(
        {
          ok: false,
          error: {
            code: 'WORKFLOW_API_KEY_NOT_FOUND',
            message:
              'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.',
          },
        },
        401
      );
    }

    return json({ ok: false, error: { code: 'WORKFLOW_AI_GENERATION_FAILED', message } }, 500);
  }

  // Parse AI response into workflow structure
  let nodes: WorkflowNode[];
  let edges: WorkflowEdge[];
  let aiConfidence: number;

  try {
    const result = parseAIResponse(aiResponse);
    nodes = result.nodes;
    edges = result.edges;
    aiConfidence = result.aiConfidence;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[workflow-analyze] AI response parsing error:', message);
    return json({ ok: false, error: { code: 'WORKFLOW_INVALID_AI_RESPONSE', message } }, 422);
  }

  // Apply ELK layout to position nodes
  try {
    nodes = await layoutWorkflow(nodes, edges, {
      algorithm: 'layered',
      direction: 'DOWN',
      nodeWidth: 200,
      nodeHeight: 60,
      nodeSpacing: 50,
      layerSpacing: 80,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[workflow-analyze] Layout error:', message);
    return json({ ok: false, error: { code: 'WORKFLOW_LAYOUT_FAILED', message } }, 500);
  }

  // Build final workflow object
  const workflow: Workflow = {
    id: createId(),
    name: templateName,
    description: templateDescription,
    nodes,
    edges,
    sourceTemplateId: templateId,
    sourceTemplateName: templateName,
    status: 'draft',
    aiGenerated: true,
    aiModel: WORKFLOW_AI_MODEL,
    aiConfidence,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return json({ ok: true, data: { workflow } }, 200);
}

// Main request handler
async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log(`[API] ${method} ${path}`);

  // Workflow Designer routes
  if (path === '/api/workflow-designer/analyze' && method === 'POST') {
    return handleWorkflowAnalyze(request);
  }

  // GitHub routes
  if (path === '/api/github/orgs' && method === 'GET') {
    return handleGitHubOrgs();
  }
  if (path === '/api/github/clone' && method === 'POST') {
    return handleGitHubClone(request);
  }
  if (path === '/api/github/create-from-template' && method === 'POST') {
    return handleCreateFromTemplate(request);
  }
  // Match /api/github/repos/:owner pattern
  const ownerReposMatch = path.match(/^\/api\/github\/repos\/([^/]+)$/);
  if (ownerReposMatch && method === 'GET') {
    const owner = ownerReposMatch[1];
    if (owner) {
      return handleGitHubReposForOwner(owner);
    }
  }
  if (path === '/api/github/repos' && method === 'GET') {
    return handleGitHubRepos();
  }
  if (path === '/api/github/token' && method === 'GET') {
    return handleGitHubTokenInfo();
  }
  if (path === '/api/github/token' && method === 'POST') {
    return handleGitHubSaveToken(request);
  }
  if (path === '/api/github/token' && method === 'DELETE') {
    return handleGitHubDeleteToken();
  }
  if (path === '/api/github/revalidate' && method === 'POST') {
    return handleGitHubRevalidate();
  }

  // Filesystem routes
  if (path === '/api/filesystem/discover-repos' && method === 'GET') {
    return handleDiscoverLocalRepos();
  }

  // Project routes
  if (path === '/api/projects' && method === 'GET') {
    return handleListProjects(url);
  }
  if (path === '/api/projects' && method === 'POST') {
    return handleCreateProject(request);
  }
  if (path === '/api/projects/summaries' && method === 'GET') {
    return handleListProjectsWithSummaries(url);
  }
  // Match /api/projects/:id pattern
  const projectIdMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectIdMatch) {
    const id = projectIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetProject(id);
      }
      if (method === 'PATCH') {
        return handleUpdateProject(id, request);
      }
      if (method === 'DELETE') {
        return handleDeleteProject(id);
      }
    }
  }

  // Template routes
  if (path === '/api/templates' && method === 'GET') {
    return handleListTemplates(url);
  }
  if (path === '/api/templates' && method === 'POST') {
    return handleCreateTemplate(request);
  }
  // Match /api/templates/:id/sync pattern (must come before :id)
  const templateSyncMatch = path.match(/^\/api\/templates\/([^/]+)\/sync$/);
  if (templateSyncMatch && method === 'POST') {
    const id = templateSyncMatch[1];
    if (id) {
      return handleSyncTemplate(id);
    }
  }
  // Match /api/templates/:id pattern
  const templateIdMatch = path.match(/^\/api\/templates\/([^/]+)$/);
  if (templateIdMatch) {
    const id = templateIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetTemplate(id);
      }
      if (method === 'PATCH') {
        return handleUpdateTemplate(id, request);
      }
      if (method === 'DELETE') {
        return handleDeleteTemplate(id);
      }
    }
  }

  // Marketplace routes
  if (path === '/api/marketplaces' && method === 'GET') {
    return handleListMarketplaces(url);
  }
  if (path === '/api/marketplaces' && method === 'POST') {
    return handleCreateMarketplace(request);
  }
  if (path === '/api/marketplaces/seed' && method === 'POST') {
    return handleSeedDefaultMarketplace();
  }
  if (path === '/api/marketplaces/plugins' && method === 'GET') {
    return handleListPlugins(url);
  }
  if (path === '/api/marketplaces/categories' && method === 'GET') {
    return handleGetCategories();
  }

  // Marketplace by ID routes
  const marketplaceMatch = path.match(/^\/api\/marketplaces\/([^/]+)$/);
  if (marketplaceMatch?.[1]) {
    const marketplaceId = marketplaceMatch[1];
    if (!isValidId(marketplaceId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid marketplace ID format' } },
        400
      );
    }
    if (request.method === 'GET') {
      return handleGetMarketplace(marketplaceId);
    }
    if (request.method === 'DELETE') {
      return handleDeleteMarketplace(marketplaceId);
    }
  }

  const marketplaceSyncMatch = path.match(/^\/api\/marketplaces\/([^/]+)\/sync$/);
  if (marketplaceSyncMatch?.[1] && request.method === 'POST') {
    const marketplaceId = marketplaceSyncMatch[1];
    if (!isValidId(marketplaceId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid marketplace ID format' } },
        400
      );
    }
    return handleSyncMarketplace(marketplaceId);
  }

  // Task routes
  if (path === '/api/tasks' && method === 'GET') {
    return handleListTasks(url);
  }
  if (path === '/api/tasks' && method === 'POST') {
    return handleCreateTask(request);
  }
  // Match /api/tasks/:id pattern
  const taskIdMatch = path.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskIdMatch) {
    const id = taskIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetTask(id);
      }
      if (method === 'PUT') {
        return handleUpdateTask(id, request);
      }
      if (method === 'DELETE') {
        return handleDeleteTask(id);
      }
    }
  }

  // API Key routes
  // Match /api/keys/:service pattern
  const apiKeyMatch = path.match(/^\/api\/keys\/([^/]+)$/);
  if (apiKeyMatch) {
    const service = apiKeyMatch[1];
    if (service) {
      if (method === 'GET') {
        return handleGetApiKey(service);
      }
      if (method === 'POST') {
        return handleSaveApiKey(service, request);
      }
      if (method === 'DELETE') {
        return handleDeleteApiKey(service);
      }
    }
  }

  // Sandbox Config routes
  if (path === '/api/sandbox-configs' && method === 'GET') {
    return handleListSandboxConfigs(url);
  }
  if (path === '/api/sandbox-configs' && method === 'POST') {
    return handleCreateSandboxConfig(request);
  }
  // Match /api/sandbox-configs/:id pattern
  const sandboxConfigIdMatch = path.match(/^\/api\/sandbox-configs\/([^/]+)$/);
  if (sandboxConfigIdMatch) {
    const id = sandboxConfigIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetSandboxConfig(id);
      }
      if (method === 'PATCH') {
        return handleUpdateSandboxConfig(id, request);
      }
      if (method === 'DELETE') {
        return handleDeleteSandboxConfig(id);
      }
    }
  }

  // Task Creation with AI routes
  if (path === '/api/tasks/create-with-ai/start' && method === 'POST') {
    return handleTaskCreationStart(request);
  }
  if (path === '/api/tasks/create-with-ai/message' && method === 'POST') {
    return handleTaskCreationMessage(request);
  }
  if (path === '/api/tasks/create-with-ai/accept' && method === 'POST') {
    return handleTaskCreationAccept(request);
  }
  if (path === '/api/tasks/create-with-ai/cancel' && method === 'POST') {
    return handleTaskCreationCancel(request);
  }
  // SSE stream endpoint
  if (path === '/api/tasks/create-with-ai/stream' && method === 'GET') {
    return handleTaskCreationStream(url);
  }

  // Sessions routes
  if (path === '/api/sessions' && method === 'GET') {
    return handleListSessions(url);
  }
  // Match /api/sessions/:id/events pattern
  const sessionEventsMatch = path.match(/^\/api\/sessions\/([^/]+)\/events$/);
  if (sessionEventsMatch) {
    const id = sessionEventsMatch[1];
    if (id && method === 'GET') {
      return handleGetSessionEvents(id, url);
    }
  }
  // Match /api/sessions/:id/summary pattern
  const sessionSummaryMatch = path.match(/^\/api\/sessions\/([^/]+)\/summary$/);
  if (sessionSummaryMatch) {
    const id = sessionSummaryMatch[1];
    if (id && method === 'GET') {
      return handleGetSessionSummary(id);
    }
  }
  // Match /api/sessions/:id pattern
  const sessionIdMatch = path.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionIdMatch) {
    const id = sessionIdMatch[1];
    if (id && method === 'GET') {
      return handleGetSession(id);
    }
  }

  // Worktree routes
  if (path === '/api/worktrees' && method === 'GET') {
    return handleListWorktrees(url);
  }
  if (path === '/api/worktrees' && method === 'POST') {
    return handleCreateWorktree(request);
  }
  if (path === '/api/worktrees/prune' && method === 'POST') {
    return handlePruneWorktrees(request);
  }
  // Match /api/worktrees/:id/commit pattern
  const worktreeCommitMatch = path.match(/^\/api\/worktrees\/([^/]+)\/commit$/);
  if (worktreeCommitMatch && method === 'POST') {
    const id = worktreeCommitMatch[1];
    if (id) {
      return handleCommitWorktree(id, request);
    }
  }
  // Match /api/worktrees/:id/merge pattern
  const worktreeMergeMatch = path.match(/^\/api\/worktrees\/([^/]+)\/merge$/);
  if (worktreeMergeMatch && method === 'POST') {
    const id = worktreeMergeMatch[1];
    if (id) {
      return handleMergeWorktree(id, request);
    }
  }
  // Match /api/worktrees/:id/diff pattern
  const worktreeDiffMatch = path.match(/^\/api\/worktrees\/([^/]+)\/diff$/);
  if (worktreeDiffMatch && method === 'GET') {
    const id = worktreeDiffMatch[1];
    if (id) {
      return handleGetWorktreeDiff(id);
    }
  }
  // Match /api/worktrees/:id pattern (must come after more specific routes)
  const worktreeIdMatch = path.match(/^\/api\/worktrees\/([^/]+)$/);
  if (worktreeIdMatch) {
    const id = worktreeIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetWorktree(id);
      }
      if (method === 'DELETE') {
        return handleRemoveWorktree(id, url);
      }
    }
  }

  // Git routes
  if (path === '/api/git/status' && method === 'GET') {
    return handleGetGitStatus(url);
  }
  if (path === '/api/git/branches' && method === 'GET') {
    return handleListGitBranches(url);
  }
  if (path === '/api/git/commits' && method === 'GET') {
    return handleListGitCommits(url);
  }
  if (path === '/api/git/remote-branches' && method === 'GET') {
    return handleListGitRemoteBranches(url);
  }

  // Workflow routes
  if (path === '/api/workflows' && method === 'GET') {
    return handleListWorkflows(url);
  }
  if (path === '/api/workflows' && method === 'POST') {
    return handleCreateWorkflow(request);
  }
  // Match /api/workflows/:id pattern
  const workflowIdMatch = path.match(/^\/api\/workflows\/([^/]+)$/);
  if (workflowIdMatch) {
    const id = workflowIdMatch[1];
    if (id) {
      if (method === 'GET') {
        return handleGetWorkflow(id);
      }
      if (method === 'PATCH') {
        return handleUpdateWorkflow(id, request);
      }
      if (method === 'DELETE') {
        return handleDeleteWorkflow(id);
      }
    }
  }

  // Kubernetes API routes
  if (path === '/api/sandbox/k8s/status' && method === 'GET') {
    return handleK8sStatus(url);
  }
  if (path === '/api/sandbox/k8s/contexts' && method === 'GET') {
    return handleK8sContexts(url);
  }
  if (path === '/api/sandbox/k8s/namespaces' && method === 'GET') {
    return handleK8sNamespaces(url);
  }

  // Health check
  if (path === '/api/health') {
    return handleHealthCheck();
  }

  return json({ ok: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }, 404);
}

// Start server
const PORT = 3001;

Bun.serve({
  port: PORT,
  fetch: handleRequest,
});

console.log(`[API Server] Running on http://localhost:${PORT}`);

// Start the template sync scheduler
startSyncScheduler(db, templateService);
console.log('[API Server] Template sync scheduler started');
