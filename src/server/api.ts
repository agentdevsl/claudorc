/**
 * Bun API Server
 *
 * Handles API requests that need database access.
 * Runs alongside Vite dev server.
 */
import { Database as BunSQLite } from 'bun:sqlite';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { agents } from '../db/schema/agents.js';
import * as schema from '../db/schema/index.js';
import { projects } from '../db/schema/projects.js';
import { tasks } from '../db/schema/tasks.js';
import { MIGRATION_SQL, SANDBOX_MIGRATION_SQL } from '../lib/bootstrap/phases/schema.js';
import { ApiKeyService } from '../services/api-key.service.js';
import { SandboxConfigService } from '../services/sandbox-config.service.js';
import {
  createTaskCreationService,
  type TaskCreationService,
} from '../services/task-creation.service.js';
import { TaskService } from '../services/task.service.js';
import { TemplateService } from '../services/template.service.js';
import type { Database } from '../types/database.js';
import type { DurableStreamsService } from '../services/durable-streams.service.js';
import { GitHubTokenService } from './github-token.service.js';

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

// TaskCreationService for AI-powered task creation
const taskCreationService: TaskCreationService = createTaskCreationService(db, mockStreamsService);

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
      mode?: 'plan' | 'implement';
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
      mode: body.mode,
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

// ============ Task Creation with AI Handlers ============

// Store active SSE connections for streaming
const sseConnections = new Map<string, ReadableStreamDefaultController<Uint8Array>>();

async function handleTaskCreationStart(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { projectId } = body as { projectId: string };

    if (!projectId) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'projectId is required' } }, 400);
    }

    const result = await taskCreationService.startConversation(projectId);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    return json({ ok: true, data: { sessionId: result.value.id } });
  } catch (error) {
    console.error('[TaskCreation] Start error:', error);
    return json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to start conversation' } }, 500);
  }
}

async function handleTaskCreationMessage(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId, message } = body as { sessionId: string; message: string };

    if (!sessionId || !message) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId and message are required' } }, 400);
    }

    // Send message with token streaming to SSE
    const controller = sseConnections.get(sessionId);
    const onToken = controller
      ? (delta: string, accumulated: string) => {
          const data = JSON.stringify({ type: 'task-creation:token', data: { delta, accumulated } });
          controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
        }
      : undefined;

    const result = await taskCreationService.sendMessage(sessionId, message, onToken);

    if (!result.ok) {
      // Send error to SSE if connected
      if (controller) {
        const errorData = JSON.stringify({ type: 'task-creation:error', data: { error: result.error.message } });
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
    return json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to send message' } }, 500);
  }
}

async function handleTaskCreationAccept(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId, overrides } = body as { sessionId: string; overrides?: Record<string, unknown> };

    if (!sessionId) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } }, 400);
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

    return json({ ok: true, data: { taskId: result.value.taskId, sessionId, status: 'completed' } });
  } catch (error) {
    console.error('[TaskCreation] Accept error:', error);
    return json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to accept suggestion' } }, 500);
  }
}

async function handleTaskCreationCancel(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const { sessionId } = body as { sessionId: string };

    if (!sessionId) {
      return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } }, 400);
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
    return json({ ok: false, error: { code: 'SERVER_ERROR', message: 'Failed to cancel session' } }, 500);
  }
}

function handleTaskCreationStream(url: URL): Response {
  const sessionId = url.searchParams.get('sessionId');
  console.log('[TaskCreation Stream] Request for sessionId:', sessionId);

  if (!sessionId) {
    console.log('[TaskCreation Stream] No sessionId provided');
    return json({ ok: false, error: { code: 'INVALID_INPUT', message: 'sessionId is required' } }, 400);
  }

  // Verify session exists
  const session = taskCreationService.getSession(sessionId);
  console.log('[TaskCreation Stream] Session lookup result:', session ? 'found' : 'not found');
  if (!session) {
    console.log('[TaskCreation Stream] Session not found, returning 404');
    return json({ ok: false, error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' } }, 404);
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
