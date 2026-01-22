import { isCuid } from '@paralleldrive/cuid2';
import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { sessionEventsSchema } from '@/lib/api/schemas';
import { parseQuery } from '@/lib/api/validation';

const { sessionService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/sessions/$id/events')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request, context }) => {
        const id = context.params?.id ?? '';

        // Validate session ID format
        if (!id || !isCuid(id)) {
          return Response.json(
            failure({ code: 'INVALID_ID', message: 'Invalid session ID format', status: 400 }),
            { status: 400 }
          );
        }

        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, sessionEventsSchema);

        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { limit, offset } = parsed.value;

        // First verify the session exists
        const sessionResult = await sessionService.getById(id);
        if (!sessionResult.ok) {
          return Response.json(failure(sessionResult.error), {
            status: sessionResult.error.status,
          });
        }

        // Get session events from persistent storage
        const result = await sessionService.getEventsBySession(id, {
          limit,
          offset,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(
          success({
            data: result.value,
            pagination: {
              total: result.value.length, // TODO: Return actual total from service
              limit,
              offset,
            },
          })
        );
      }),
    },
  },
});
