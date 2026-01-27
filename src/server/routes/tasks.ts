/**
 * Task routes
 */

import { Hono } from 'hono';
import type { AgentService } from '../../services/agent.service.js';
import type { TaskService } from '../../services/task.service.js';
import { isValidId, json } from '../shared.js';

interface TasksDeps {
  taskService: TaskService;
  agentService: AgentService;
}

export function createTasksRoutes({ taskService, agentService }: TasksDeps) {
  const app = new Hono();

  // GET /api/tasks
  app.get('/', async (c) => {
    const projectId = c.req.query('projectId');
    const column = c.req.query('column') as
      | 'backlog'
      | 'queued'
      | 'in_progress'
      | 'waiting_approval'
      | 'verified'
      | undefined;
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    if (!projectId) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'projectId is required' } },
        400
      );
    }

    if (!isValidId(projectId)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
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
  });

  // POST /api/tasks
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as {
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

      if (!isValidId(body.projectId)) {
        return json(
          { ok: false, error: { code: 'INVALID_ID', message: 'Invalid projectId format' } },
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
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create task' } },
        500
      );
    }
  });

  // GET /api/tasks/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

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
  });

  // PUT /api/tasks/:id
  app.put('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

    try {
      const body = (await c.req.json()) as {
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
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update task' } },
        500
      );
    }
  });

  // DELETE /api/tasks/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

    try {
      const result = await taskService.delete(id);

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: null });
    } catch (error) {
      console.error('[Tasks] Delete error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete task' } },
        500
      );
    }
  });

  // PATCH /api/tasks/:id/move - Move task to different column
  // When moving to in_progress, optionally auto-start an agent
  app.patch('/:id/move', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

    try {
      const body = (await c.req.json()) as {
        column: 'backlog' | 'queued' | 'in_progress' | 'waiting_approval' | 'verified';
        position?: number;
        startAgent?: boolean; // Auto-start agent when moving to in_progress (default: true)
      };

      if (!body.column) {
        return json(
          { ok: false, error: { code: 'MISSING_PARAMS', message: 'column is required' } },
          400
        );
      }

      const validColumns = ['backlog', 'queued', 'in_progress', 'waiting_approval', 'verified'];
      if (!validColumns.includes(body.column)) {
        return json(
          { ok: false, error: { code: 'INVALID_PARAMS', message: 'Invalid column value' } },
          400
        );
      }

      // Get the task first to know its projectId
      const taskResult = await taskService.getById(id);
      if (!taskResult.ok) {
        return json({ ok: false, error: taskResult.error }, taskResult.error.status);
      }
      const task = taskResult.value;

      // If moving to in_progress, auto-start an agent
      const shouldStartAgent = body.column === 'in_progress' && body.startAgent !== false;

      if (shouldStartAgent) {
        // Find or create an idle agent for this project
        const agentsResult = await agentService.list(task.projectId);
        let agentId: string | null = null;

        if (agentsResult.ok) {
          // Find an idle agent
          const idleAgent = agentsResult.value.find((a) => a.status === 'idle');
          if (idleAgent) {
            agentId = idleAgent.id;
          }
        }

        // If no idle agent, create one
        if (!agentId) {
          const createResult = await agentService.create({
            projectId: task.projectId,
            name: `Agent for ${task.title.slice(0, 30)}`,
          });
          if (createResult.ok) {
            agentId = createResult.value.id;
            console.log(`[Tasks] Created new agent ${agentId} for task ${id}`);
          } else {
            console.error('[Tasks] Failed to create agent:', createResult.error);
            // Continue without starting agent - task will still move
          }
        }

        // Start the agent with this task
        if (agentId) {
          const startResult = await agentService.start(agentId, id);
          if (startResult.ok) {
            console.log(`[Tasks] Started agent ${agentId} for task ${id}`);
            // Return the full agent start result
            return json({
              ok: true,
              data: {
                task: startResult.value.task,
                agent: startResult.value.agent,
                session: startResult.value.session,
                worktree: startResult.value.worktree,
              },
            });
          } else {
            console.error('[Tasks] Failed to start agent:', startResult.error);
            // Fall through to just move the task without agent
          }
        }
      }

      // Regular move without agent start
      const result = await taskService.moveColumn(id, body.column, body.position);

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Tasks] Move error:', error);
      return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to move task' } }, 500);
    }
  });

  return app;
}
