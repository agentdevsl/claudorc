import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';

const { worktreeService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/worktrees/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await worktreeService.getStatus(id);

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),

      DELETE: withErrorHandling(async ({ request, context }) => {
        const id = context.params?.id ?? '';
        const url = new URL(request.url);
        const force = url.searchParams.get('force') === 'true';

        const result = await worktreeService.remove(id, force);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ deleted: true }));
      }),
    },
  },
});
