import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { SessionService } from '@/services/session.service';

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

export const Route = createFileRoute('/api/sessions/$id/close')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await sessionService.close(id);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
