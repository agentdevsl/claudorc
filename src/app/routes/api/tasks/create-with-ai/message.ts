import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/tasks/create-with-ai/message')({
  server: {
    handlers: {
      /**
       * POST /api/tasks/create-with-ai/message - Send a message in the conversation
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
          const { sessionId, message } = body as { sessionId: string; message: string };

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

          if (!message) {
            return new Response(
              JSON.stringify({
                error: 'message is required',
                code: 'MISSING_MESSAGE',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          // Send message - this will publish events to durable streams
          const result = await services.taskCreationService.sendMessage(sessionId, message);

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
              messageCount: result.value.messages.length,
              hasSuggestion: result.value.suggestion !== null,
              suggestion: result.value.suggestion,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          console.error('[Task Creation] Error sending message:', error);
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
