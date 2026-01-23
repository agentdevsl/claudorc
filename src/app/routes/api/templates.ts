import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { encodeCursor } from '@/lib/api/cursor';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createTemplateSchema, listTemplatesSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';

export const Route = createFileRoute('/api/templates')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const { templateService } = getApiServicesOrThrow();
        const parsed = parseQuery(new URL(request.url).searchParams, listTemplatesSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await templateService.list({
          scope: parsed.value.scope,
          projectId: parsed.value.projectId,
          limit: parsed.value.limit,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        const items = result.value;
        const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
        const nextCursor = lastItem
          ? encodeCursor({
              id: lastItem.id,
              sortValue: lastItem.updatedAt?.toString() ?? null,
              sortField: 'updatedAt',
              order: 'desc',
            })
          : null;

        return Response.json(
          success({
            items,
            nextCursor,
            hasMore: false,
            totalCount: items.length,
          })
        );
      }),
      POST: withErrorHandling(async ({ request }) => {
        const { templateService } = getApiServicesOrThrow();
        const parsed = await parseBody(request, createTemplateSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await templateService.create({
          name: parsed.value.name,
          description: parsed.value.description,
          scope: parsed.value.scope,
          githubUrl: parsed.value.githubUrl,
          branch: parsed.value.branch,
          configPath: parsed.value.configPath,
          projectId: parsed.value.projectId,
          syncIntervalMinutes: parsed.value.syncIntervalMinutes,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
