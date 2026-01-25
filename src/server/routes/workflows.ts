/**
 * Workflow routes
 */

import { and, count, desc, eq, like, or } from 'drizzle-orm';
import { Hono } from 'hono';
import { workflows } from '../../db/schema/workflows.js';
import type { Database } from '../../types/database.js';
import { json } from '../shared.js';

interface WorkflowsDeps {
  db: Database;
}

export function createWorkflowsRoutes({ db }: WorkflowsDeps) {
  const app = new Hono();

  // GET /api/workflows
  app.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);
    const status = c.req.query('status');
    const search = c.req.query('search');

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
  });

  // POST /api/workflows
  app.post('/', async (c) => {
    const body = (await c.req.json()) as {
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
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'Name is required' } },
        400
      );
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
  });

  // GET /api/workflows/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      const workflow = await db.query.workflows.findFirst({
        where: eq(workflows.id, id),
      });

      if (!workflow) {
        return json(
          {
            ok: false,
            error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` },
          },
          404
        );
      }

      return json({ ok: true, data: workflow });
    } catch (error) {
      console.error('[Workflows] Get error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get workflow' } },
        500
      );
    }
  });

  // PATCH /api/workflows/:id
  app.patch('/:id', async (c) => {
    const id = c.req.param('id');
    const body = (await c.req.json()) as {
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
          {
            ok: false,
            error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` },
          },
          404
        );
      }

      // Build update object with only provided fields
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
        ...(body.name !== undefined && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.nodes !== undefined && { nodes: body.nodes }),
        ...(body.edges !== undefined && { edges: body.edges }),
        ...(body.viewport !== undefined && { viewport: body.viewport }),
        ...(body.status !== undefined && {
          status: body.status as 'draft' | 'published' | 'archived',
        }),
        ...(body.tags !== undefined && { tags: body.tags }),
        ...(body.sourceTemplateId !== undefined && { sourceTemplateId: body.sourceTemplateId }),
        ...(body.sourceTemplateName !== undefined && {
          sourceTemplateName: body.sourceTemplateName,
        }),
        ...(body.thumbnail !== undefined && { thumbnail: body.thumbnail }),
        ...(body.aiGenerated !== undefined && { aiGenerated: body.aiGenerated }),
        ...(body.aiModel !== undefined && { aiModel: body.aiModel }),
        ...(body.aiConfidence !== undefined && { aiConfidence: body.aiConfidence }),
      };

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
  });

  // DELETE /api/workflows/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      // Check if workflow exists
      const existing = await db.query.workflows.findFirst({
        where: eq(workflows.id, id),
      });

      if (!existing) {
        return json(
          {
            ok: false,
            error: { code: 'NOT_FOUND', message: `Workflow with id '${id}' not found` },
          },
          404
        );
      }

      await db.delete(workflows).where(eq(workflows.id, id));

      return json({ ok: true, data: null });
    } catch (error) {
      console.error('[Workflows] Delete error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete workflow' } },
        500
      );
    }
  });

  return app;
}
