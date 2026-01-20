import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { failure, success } from '@/lib/api/response';

export const Route = createFileRoute('/api/plans/$taskId/answer')({
  server: {
    handlers: {
      /**
       * POST /api/plans/:taskId/answer - Answer an interaction question in a plan session
       */
      POST: async ({ params, request }: { params: { taskId: string }; request: Request }) => {
        try {
          const body = await request.json();
          const { interactionId, answers } = body as {
            interactionId: string;
            answers: Record<string, string>;
          };

          if (!interactionId || !answers) {
            return Response.json(
              failure({
                code: 'VALIDATION_ERROR',
                message: 'Missing required fields: interactionId, answers',
                status: 400,
              }),
              { status: 400 }
            );
          }

          const services = getApiServicesOrThrow();

          // Get existing session for this task
          const sessionResult = await services.planModeService.getByTaskId(params.taskId);

          if (!sessionResult.ok) {
            return Response.json(
              failure({
                code: 'SESSION_ERROR',
                message: 'Failed to get session',
                status: 400,
              }),
              { status: 400 }
            );
          }

          if (!sessionResult.value) {
            return Response.json(
              failure({
                code: 'SESSION_NOT_FOUND',
                message: 'No plan session found for this task',
                status: 404,
              }),
              { status: 404 }
            );
          }

          // Respond to the interaction
          const result = await services.planModeService.respondToInteraction({
            sessionId: sessionResult.value.id,
            interactionId,
            answers,
          });

          if (!result.ok) {
            return Response.json(
              failure({
                code: result.error.code,
                message: result.error.message,
                status: 400,
              }),
              { status: 400 }
            );
          }

          return Response.json(success({ session: result.value }));
        } catch (error) {
          console.error('[Plans API] Error answering interaction:', error);
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Failed to answer interaction',
              status: 500,
            }),
            { status: 500 }
          );
        }
      },
    },
  },
});
