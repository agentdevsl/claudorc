import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/tasks/create-with-ai/start')({
  server: {
    handlers: {
      /**
       * POST /api/tasks/create-with-ai/start - Start a new AI task creation conversation
       */
      POST: async ({ request }: { request: Request }) => {
        let services;
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
          const { projectId } = body as { projectId: string };

          if (!projectId) {
            return new Response(
              JSON.stringify({
                error: 'projectId is required',
                code: 'MISSING_PROJECT_ID',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          const result = await services.taskCreationService.startConversation(projectId);

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
              projectId: result.value.projectId,
              status: result.value.status,
              createdAt: result.value.createdAt,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          console.error('[Task Creation] Error starting conversation:', error);
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
