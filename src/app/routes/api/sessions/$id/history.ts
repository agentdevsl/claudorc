import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';

const { sessionService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/sessions/$id/history')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request, context }) => {
        const id = context.params?.id ?? '';
        const startTime = new URL(request.url).searchParams.get('startTime');
        const result = await sessionService.getHistory(id, {
          startTime: startTime ? Number.parseInt(startTime, 10) : undefined,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
