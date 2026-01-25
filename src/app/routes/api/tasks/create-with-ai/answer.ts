import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow, type Services } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/tasks/create-with-ai/answer')({
  server: {
    handlers: {
      /**
       * POST /api/tasks/create-with-ai/answer - Submit answers to clarifying questions
       */
      POST: async ({ request }: { request: Request }) => {
        let services: Services;
        try {
          services = getApiServicesOrThrow();
        } catch (error) {
          console.error('[Task Creation] Services not available:', error);
          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'SERVICES_NOT_CONFIGURED',
                message: 'Services not available',
              },
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        try {
          const body = await request.json();
          const { sessionId, questionsId, answers } = body as {
            sessionId: string;
            questionsId: string;
            answers: Record<string, string>;
          };

          if (!sessionId) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'MISSING_SESSION_ID',
                  message: 'sessionId is required',
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          if (!questionsId) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'MISSING_QUESTIONS_ID',
                  message: 'questionsId is required',
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          if (!answers || typeof answers !== 'object') {
            return new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'MISSING_ANSWERS',
                  message: 'answers object is required',
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          const result = await services.taskCreationService.answerQuestions(
            sessionId,
            questionsId,
            answers
          );

          if (!result.ok) {
            return new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: result.error.code,
                  message: result.error.message,
                },
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }

          return new Response(
            JSON.stringify({
              ok: true,
              data: {
                sessionId: result.value.id,
                status: result.value.status,
              },
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        } catch (error) {
          console.error('[Task Creation] Error answering questions:', error);
          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Internal server error',
              },
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
