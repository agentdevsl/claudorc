import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createWorktreeSchema, listWorktreesSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';

const { worktreeService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/worktrees/')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, listWorktreesSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await worktreeService.list(parsed.value.projectId);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: 500 });
        }

        return Response.json(success(result.value));
      }),

      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createWorktreeSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await worktreeService.create({
          projectId: parsed.value.projectId,
          taskId: parsed.value.taskId,
          baseBranch: parsed.value.baseBranch,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
