import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { commitWorktreeSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';

const { worktreeService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/worktrees/$id/commit')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, commitWorktreeSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        const result = await worktreeService.commit(id, parsed.value.message);

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ sha: result.value }));
      }),
    },
  },
});
