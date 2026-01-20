import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow, type Services } from '@/app/routes/api/runtime';
import type { TaskSuggestion } from '@/services/task-creation.service';

export const Route = createFileRoute('/api/tasks/create-with-ai/accept')({
  server: {
    handlers: {
      /**
       * POST /api/tasks/create-with-ai/accept - Accept the suggestion and create a task
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
          const { sessionId, overrides } = body as {
            sessionId: string;
            overrides?: Partial<TaskSuggestion>;
          };

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

          const result = await services.taskCreationService.acceptSuggestion(sessionId, overrides);

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
              taskId: result.value.taskId,
              sessionId: result.value.session.id,
              status: result.value.session.status,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          console.error('[Task Creation] Error accepting suggestion:', error);
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
