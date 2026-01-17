import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { SessionService } from '@/services/session.service';
import { failure, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/middleware';
import { parseBody } from '@/lib/api/validation';
import { createSessionSchema } from '@/lib/api/schemas';

const sessionService = new SessionService(
  db,
  {
    createStream: async () => undefined,
    publish: async () => undefined,
    subscribe: async function* () {
      yield { type: 'chunk', data: {} };
    },
  },
  { baseUrl: process.env.APP_URL ?? 'http://localhost:5173' }
);

export const Route = createFileRoute('/api/sessions')({
  server: {
    handlers: {
      GET: withErrorHandling(async () => {
        const result = await sessionService.list();
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
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
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
