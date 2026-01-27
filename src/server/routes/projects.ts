/**
 * Project routes
 */

import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { agents } from '../../db/schema/agents.js';
import { projects } from '../../db/schema/projects.js';
import { tasks } from '../../db/schema/tasks.js';
import type { Database } from '../../types/database.js';
import { isValidId, json } from '../shared.js';

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  path: z.string().min(1, 'Path is required'),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  maxConcurrentAgents: z.number().int().positive().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

interface ProjectsDeps {
  db: Database;
}

export function createProjectsRoutes({ db }: ProjectsDeps) {
  const app = new Hono();

  // GET /api/projects
  app.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '24', 10);

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
  });

  // POST /api/projects
  app.post('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request',
          },
        },
        400
      );
    }

    try {
      // Check if project with this path already exists
      const existing = await db.query.projects.findFirst({
        where: eq(projects.path, parsed.data.path),
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
          name: parsed.data.name,
          path: parsed.data.path,
          description: parsed.data.description,
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
  });

  // GET /api/projects/summaries
  app.get('/summaries', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '24', 10);

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
        {
          ok: false,
          error: { code: 'DB_ERROR', message: 'Failed to list projects with summaries' },
        },
        500
      );
    }
  });

  // GET /api/projects/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

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
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get project' } },
        500
      );
    }
  });

  // PATCH /api/projects/:id
  app.patch('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

    const parsed = updateProjectSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request',
          },
        },
        400
      );
    }

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
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.maxConcurrentAgents !== undefined && {
          maxConcurrentAgents: parsed.data.maxConcurrentAgents,
        }),
        ...(parsed.data.config !== undefined && {
          config: { ...(existing.config ?? {}), ...parsed.data.config },
        }),
      };

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
  });

  // DELETE /api/projects/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');
    const deleteFiles = c.req.query('deleteFiles') === 'true';

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

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

      // Delete the project from database
      await db.delete(projects).where(eq(projects.id, id));

      // Optionally delete project files
      if (deleteFiles && existing.path) {
        const fs = await import('node:fs/promises');
        const pathModule = await import('node:path');

        // Safety check: ensure the path exists and is a directory
        try {
          // Resolve to absolute path and normalize to prevent traversal attacks
          const resolvedPath = pathModule.resolve(existing.path);
          const normalizedPath = pathModule.normalize(resolvedPath);

          // Block system directories and their children
          const dangerousPrefixes = [
            '/',
            '/bin',
            '/sbin',
            '/etc',
            '/var',
            '/usr',
            '/lib',
            '/opt',
            '/root',
            '/home',
            '/Users',
            '/System',
            '/Applications',
            '/Library',
          ];

          // Check if path is exactly a dangerous path or is too shallow (less than 3 components)
          const pathComponents = normalizedPath.split(pathModule.sep).filter(Boolean);
          const isDangerousExact = dangerousPrefixes.includes(normalizedPath);
          const isTooShallow = pathComponents.length < 3; // e.g., /home/user is too shallow

          // Check if path starts with a dangerous prefix AND is within first 2 levels
          const startsWithDangerous = dangerousPrefixes.some(
            (prefix) =>
              normalizedPath === prefix || normalizedPath.startsWith(prefix + pathModule.sep)
          );

          if (isDangerousExact || isTooShallow) {
            console.warn(`[Projects] Refusing to delete dangerous/shallow path: ${normalizedPath}`);
            return json({
              ok: true,
              data: {
                deleted: true,
                filesDeleted: false,
                reason: 'Path too shallow or matches system directory',
              },
            });
          }

          // Additional check: path must be at least 3 levels deep to delete
          // e.g., /Users/name/projects/myproject is OK, /Users/name is not
          if (startsWithDangerous && pathComponents.length < 4) {
            console.warn(
              `[Projects] Refusing to delete path with insufficient depth: ${normalizedPath}`
            );
            return json({
              ok: true,
              data: {
                deleted: true,
                filesDeleted: false,
                reason: 'Path depth insufficient for safe deletion',
              },
            });
          }

          const stats = await fs.stat(normalizedPath);
          if (stats.isDirectory()) {
            await fs.rm(normalizedPath, { recursive: true, force: true });
            console.log(`[Projects] Deleted project files at: ${normalizedPath}`);
          }
        } catch (fsError) {
          // Log but don't fail if file deletion fails
          console.error(`[Projects] Failed to delete project files: ${fsError}`);
        }
      }

      return json({ ok: true, data: { deleted: true, filesDeleted: deleteFiles } });
    } catch (error) {
      console.error('[Projects] Delete error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete project' } },
        500
      );
    }
  });

  return app;
}
