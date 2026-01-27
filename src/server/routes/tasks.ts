/**
 * Task routes
 */

import { Hono } from 'hono';
import type { TaskService } from '../../services/task.service.js';
import { isValidId, json } from '../shared.js';

interface TasksDeps {
  taskService: TaskService;
}

export function createTasksRoutes({ taskService }: TasksDeps) {
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
  app.patch('/:id/move', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json({ ok: false, error: { code: 'INVALID_ID', message: 'Invalid ID format' } }, 400);
    }

    try {
      const body = (await c.req.json()) as {
        column: 'backlog' | 'queued' | 'in_progress' | 'waiting_approval' | 'verified';
        position?: number;
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
