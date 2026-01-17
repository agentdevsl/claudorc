import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { updatePresenceSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
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

export const Route = createFileRoute('/api/sessions/$id/presence')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await sessionService.getActiveUsers(id);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
      POST: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, updatePresenceSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        const { userId, ...presenceUpdate } = parsed.value;
        const result = await sessionService.updatePresence(id, userId, presenceUpdate);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ updated: true }));
      }),
    },
  },
});
