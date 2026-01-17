import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { encodeCursor } from '@/lib/api/cursor';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createProjectSchema, listProjectsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';
import { ProjectService } from '@/services/project.service';
import { WorktreeService } from '@/services/worktree.service';

const runtime = getApiRuntime();
if (!runtime.ok) {
  throw new Error(runtime.error.message);
}

const worktreeService = new WorktreeService(runtime.value.db, runtime.value.runner);

const service = new ProjectService(runtime.value.db, worktreeService, runtime.value.runner);

export const Route = createFileRoute('/api/projects')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const parsed = parseQuery(new URL(request.url).searchParams, listProjectsSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await service.list({
          limit: parsed.value.limit,
          orderBy: 'updatedAt',
          orderDirection: 'desc',
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
        const parsed = await parseBody(request, createProjectSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await service.create({
          path: parsed.value.path,
          name: parsed.value.name,
          description: parsed.value.description,
          config: parsed.value.config,
          maxConcurrentAgents: parsed.value.maxConcurrentAgents,
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
