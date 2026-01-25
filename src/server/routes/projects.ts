/**
 * Project routes
 */

import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { agents } from '../../db/schema/agents.js';
import { projects } from '../../db/schema/projects.js';
import { tasks } from '../../db/schema/tasks.js';
import type { Database } from '../../types/database.js';
import { json } from '../shared.js';

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
    const body = (await c.req.json()) as { name: string; path: string; description?: string };

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
    const body = (await c.req.json()) as {
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
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.maxConcurrentAgents !== undefined && {
          maxConcurrentAgents: body.maxConcurrentAgents,
        }),
        ...(body.config !== undefined && {
          config: { ...(existing.config ?? {}), ...body.config },
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
  });

  return app;
}
