/**
 * Bun API Server
 *
 * Handles API requests that need database access.
 * Runs alongside Vite dev server.
 */
import { Database } from 'bun:sqlite';
import { desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../db/schema/index.js';
import { projects } from '../db/schema/projects.js';
import { ApiKeyService } from '../services/api-key.service.js';
import { GitHubTokenService } from './github-token.service.js';

// Initialize SQLite database using Bun's native SQLite
const DB_PATH = './data/agentpane.db';
const sqlite = new Database(DB_PATH);
const db = drizzle(sqlite, { schema });

// Initialize services
const githubService = new GitHubTokenService(db);
const apiKeyService = new ApiKeyService(db);

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
    }
  } catch {
    checks.github = { status: 'error' };
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
        } catch {
          // Skip entries we can't access
        }
      }
    } catch {
      // Skip directories we can't read
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

  const [owner, repo] = repoFullName.split('/');

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
  console.log(`[Template] Waiting for repo ${createResult.value.fullName} to be ready...`);
  const isReady = await waitForRepoReady(createResult.value.fullName);

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
    let cloneUrl = createResult.value.cloneUrl;
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
    return handleGitHubReposForOwner(ownerReposMatch[1]);
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
  // Match /api/projects/:id pattern
  const projectIdMatch = path.match(/^\/api\/projects\/([^/]+)$/);
  if (projectIdMatch && method === 'GET') {
    return handleGetProject(projectIdMatch[1]);
  }

  // API Key routes
  // Match /api/keys/:service pattern
  const apiKeyMatch = path.match(/^\/api\/keys\/([^/]+)$/);
  if (apiKeyMatch) {
    const service = apiKeyMatch[1];
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
