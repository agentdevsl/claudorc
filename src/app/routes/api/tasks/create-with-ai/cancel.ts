import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow, type Services } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/tasks/create-with-ai/cancel')({
  server: {
    handlers: {
      /**
       * POST /api/tasks/create-with-ai/cancel - Cancel a task creation session
       */
      POST: async ({ request }: { request: Request }) => {
        let services: Services;
        try {
          services = getApiServicesOrThrow();
        } catch (error) {
          console.error('[Task Creation] Services not available:', error);
          return new Response(
            JSON.stringify({
              error: 'Services not available',
              code: 'SERVICES_NOT_CONFIGURED',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          const body = await request.json();
          const { sessionId } = body as { sessionId: string };

          if (!sessionId) {
            return new Response(
              JSON.stringify({
                error: 'sessionId is required',
                code: 'MISSING_SESSION_ID',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          const result = await services.taskCreationService.cancel(sessionId);

          if (!result.ok) {
            return new Response(
              JSON.stringify({
                error: result.error.message,
                code: result.error.code,
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(
            JSON.stringify({
              sessionId: result.value.id,
              status: result.value.status,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          console.error('[Task Creation] Error cancelling session:', error);
          return new Response(
            JSON.stringify({
              error: 'Internal server error',
              code: 'INTERNAL_ERROR',
            }),
            {
              status: 500,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }
      },
    },
  },
});
