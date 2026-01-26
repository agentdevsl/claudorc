/**
 * Worktree routes
 */

import { Hono } from 'hono';
import type { WorktreeService } from '../../services/worktree.service.js';
import { isValidId, json } from '../shared.js';

interface WorktreesDeps {
  worktreeService: WorktreeService;
}

export function createWorktreesRoutes({ worktreeService }: WorktreesDeps) {
  const app = new Hono();

  // GET /api/worktrees
  app.get('/', async (c) => {
    const projectId = c.req.query('projectId');

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
  });

  // POST /api/worktrees
  app.post('/', async (c) => {
    let body: {
      projectId: string;
      taskId: string;
      baseBranch?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

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
  });

  // POST /api/worktrees/prune
  app.post('/prune', async (c) => {
    let body: { projectId?: string };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }
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
  });

  // POST /api/worktrees/:id/commit
  app.post('/:id/commit', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid worktree ID format' } },
        400
      );
    }

    let body: { message: string };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

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
  });

  // POST /api/worktrees/:id/merge
  app.post('/:id/merge', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid worktree ID format' } },
        400
      );
    }

    let body: {
      targetBranch?: string;
      deleteAfterMerge?: boolean;
      squash?: boolean;
      commitMessage?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

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
  });

  // GET /api/worktrees/:id/diff
  app.get('/:id/diff', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid worktree ID format' } },
        400
      );
    }

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
  });

  // GET /api/worktrees/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid worktree ID format' } },
        400
      );
    }

    try {
      const result = await worktreeService.getStatus(id);

      if (!result.ok) {
        return json(
          { ok: false, error: { code: 'NOT_FOUND', message: 'Worktree not found' } },
          404
        );
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Worktrees] Get error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get worktree' } },
        500
      );
    }
  });

  // DELETE /api/worktrees/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid worktree ID format' } },
        400
      );
    }

    const force = c.req.query('force') === 'true';

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
  });

  return app;
}
