import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { pruneWorktreesSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';

const { worktreeService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/worktrees/prune')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, pruneWorktreesSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await worktreeService.prune(parsed.value.projectId);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
