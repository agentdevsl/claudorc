import { createFileRoute } from '@tanstack/react-router';
import { and, count, desc, eq, like, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqlite } from '@/db/client';
import * as schema from '@/db/schema/index.js';
import {
  type NewWorkflow,
  type WorkflowEdge,
  type WorkflowNode,
  workflows,
} from '@/db/schema/workflows.js';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createWorkflowSchema, listWorkflowsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';

const getDb = () => {
  if (!sqlite) {
    throw new Error('Database not available');
  }
  return drizzle(sqlite, { schema });
};

export const Route = createFileRoute('/api/workflows')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const parsed = parseQuery(new URL(request.url).searchParams, listWorkflowsSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const db = getDb();
        const { limit, offset = 0, status, search } = parsed.value;

        // Build where conditions
        const conditions = [];

        if (status) {
          conditions.push(eq(workflows.status, status));
        }

        if (search) {
          const searchPattern = `%${search}%`;
          conditions.push(
            or(like(workflows.name, searchPattern), like(workflows.description, searchPattern))
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Get total count
        const [countResult] = await db
          .select({ total: count() })
          .from(workflows)
          .where(whereClause);

        const totalCount = countResult?.total ?? 0;

        // Get paginated items
        const items = await db.query.workflows.findMany({
          where: whereClause,
          orderBy: [desc(workflows.updatedAt)],
          limit,
          offset,
        });

        return Response.json(
          success({
            items,
            totalCount,
            limit,
            offset,
            hasMore: offset + items.length < totalCount,
          })
        );
      }),
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createWorkflowSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const db = getDb();
        const now = new Date().toISOString();

        const newWorkflow: NewWorkflow = {
          name: parsed.value.name,
          description: parsed.value.description,
          // Cast to DB types - Zod has validated the structure
          nodes: parsed.value.nodes as WorkflowNode[] | undefined,
          edges: parsed.value.edges as WorkflowEdge[] | undefined,
          viewport: parsed.value.viewport,
          status: parsed.value.status ?? 'draft',
          tags: parsed.value.tags,
          sourceTemplateId: parsed.value.sourceTemplateId,
          sourceTemplateName: parsed.value.sourceTemplateName,
          thumbnail: parsed.value.thumbnail,
          aiGenerated: parsed.value.aiGenerated,
          aiModel: parsed.value.aiModel,
          aiConfidence: parsed.value.aiConfidence,
          createdAt: now,
          updatedAt: now,
        };

        const [created] = await db.insert(workflows).values(newWorkflow).returning();

        if (!created) {
          return Response.json(
            failure({
              code: 'CREATE_FAILED',
              message: 'Failed to create workflow',
              status: 500,
            }),
            { status: 500 }
          );
        }

        return Response.json(success(created), { status: 201 });
      }),
    },
  },
});
