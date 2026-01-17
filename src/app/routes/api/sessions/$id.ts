import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
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

export const Route = createFileRoute('/api/sessions/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await sessionService.getById(id);
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
