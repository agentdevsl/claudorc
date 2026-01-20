import { createFileRoute } from '@tanstack/react-router';
import { hasStreamProvider } from '@/lib/streams/provider';

export const Route = createFileRoute('/api/streams/')({
  server: {
    handlers: {
      /**
       * GET /api/streams - List all active streams (admin endpoint)
       */
      GET: async () => {
        if (!hasStreamProvider()) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'STREAMS_NOT_CONFIGURED', message: 'Streams not configured' },
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // This endpoint is primarily for debugging/admin purposes
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: 'active',
              message: 'Durable streams server is running',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },
    },
  },
});
