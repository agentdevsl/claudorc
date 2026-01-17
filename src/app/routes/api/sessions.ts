import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createSessionSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
import { SessionService } from '@/services/session.service';

const runtime = getApiRuntime();
if (!runtime.ok) {
  throw new Error(runtime.error.message);
}

if (!runtime.value.streams) {
  throw new Error('Stream provider not configured');
}

const sessionService = new SessionService(runtime.value.db, runtime.value.streams, {
  baseUrl: process.env.APP_URL ?? 'http://localhost:5173',
});

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
