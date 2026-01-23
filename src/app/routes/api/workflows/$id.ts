import { createFileRoute } from '@tanstack/react-router';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqlite } from '@/db/client';
import * as schema from '@/db/schema/index.js';
import { type Workflow, workflows } from '@/db/schema/workflows.js';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { updateWorkflowSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';

const getDb = () => {
  if (!sqlite) {
    throw new Error('Database not available');
  }
  return drizzle(sqlite, { schema });
};

export const Route = createFileRoute('/api/workflows/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Workflow id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const db = getDb();
        const workflow = await db.query.workflows.findFirst({
          where: eq(workflows.id, id),
        });

        if (!workflow) {
          return Response.json(
            failure({
              code: 'NOT_FOUND',
              message: `Workflow with id '${id}' not found`,
              status: 404,
            }),
            { status: 404 }
          );
        }

        return Response.json(success(workflow));
      }),
      PATCH: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, updateWorkflowSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Workflow id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const db = getDb();

        // Check if workflow exists
        const existing = await db.query.workflows.findFirst({
          where: eq(workflows.id, id),
        });

        if (!existing) {
          return Response.json(
            failure({
              code: 'NOT_FOUND',
              message: `Workflow with id '${id}' not found`,
              status: 404,
            }),
            { status: 404 }
          );
        }

        // Build update object with only provided fields
        const updates: Partial<Workflow> = {
          updatedAt: new Date().toISOString(),
        };

        if (parsed.value.name !== undefined) {
          updates.name = parsed.value.name;
        }
        if (parsed.value.description !== undefined) {
          updates.description = parsed.value.description;
        }
        if (parsed.value.nodes !== undefined) {
          updates.nodes = parsed.value.nodes;
        }
        if (parsed.value.edges !== undefined) {
          updates.edges = parsed.value.edges;
        }
        if (parsed.value.viewport !== undefined) {
          updates.viewport = parsed.value.viewport;
        }
        if (parsed.value.status !== undefined) {
          updates.status = parsed.value.status;
        }
        if (parsed.value.tags !== undefined) {
          updates.tags = parsed.value.tags;
        }
        if (parsed.value.sourceTemplateId !== undefined) {
          updates.sourceTemplateId = parsed.value.sourceTemplateId;
        }
        if (parsed.value.sourceTemplateName !== undefined) {
          updates.sourceTemplateName = parsed.value.sourceTemplateName;
        }
        if (parsed.value.thumbnail !== undefined) {
          updates.thumbnail = parsed.value.thumbnail;
        }
        if (parsed.value.aiGenerated !== undefined) {
          updates.aiGenerated = parsed.value.aiGenerated;
        }
        if (parsed.value.aiModel !== undefined) {
          updates.aiModel = parsed.value.aiModel;
        }
        if (parsed.value.aiConfidence !== undefined) {
          updates.aiConfidence = parsed.value.aiConfidence;
        }

        const [updated] = await db
          .update(workflows)
          .set(updates)
          .where(eq(workflows.id, id))
          .returning();

        if (!updated) {
          return Response.json(
            failure({
              code: 'UPDATE_FAILED',
              message: 'Failed to update workflow',
              status: 500,
            }),
            { status: 500 }
          );
        }

        return Response.json(success(updated));
      }),
      DELETE: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Workflow id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const db = getDb();

        // Check if workflow exists
        const existing = await db.query.workflows.findFirst({
          where: eq(workflows.id, id),
        });

        if (!existing) {
          return Response.json(
            failure({
              code: 'NOT_FOUND',
              message: `Workflow with id '${id}' not found`,
              status: 404,
            }),
            { status: 404 }
          );
        }

        await db.delete(workflows).where(eq(workflows.id, id));

        // Return 204 No Content for successful deletion
        return new Response(null, { status: 204 });
      }),
    },
  },
});
