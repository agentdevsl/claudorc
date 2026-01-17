import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createSessionSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';

const { sessionService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/sessions')({
  server: {
    handlers: {
      GET: withErrorHandling(async () => {
        const result = await sessionService.list();
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createSessionSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await sessionService.create(parsed.value);
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
