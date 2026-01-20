import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { failure } from '@/lib/api/response';

export const Route = createFileRoute('/api/plans/$taskId/message')({
  server: {
    handlers: {
      /**
       * POST /api/plans/:taskId/message - Send a message in an existing plan session
       *
       * Note: In plan mode, messages are typically sent through the interaction flow.
       * This endpoint is for direct user messages in the conversation.
       */
      POST: async ({ params, request }: { params: { taskId: string }; request: Request }) => {
        try {
          const body = await request.json();
          const { message } = body as { message: string };

          if (!message) {
            return Response.json(
              failure({
                code: 'VALIDATION_ERROR',
                message: 'Missing required field: message',
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
                message: 'No plan session found for this task. Start a new session first.',
                status: 404,
              }),
              { status: 404 }
            );
          }

          // For now, we don't support arbitrary messages outside of interactions
          // The plan mode uses a structured interaction flow
          return Response.json(
            failure({
              code: 'NOT_SUPPORTED',
              message:
                'Direct messages are not supported in plan mode. Use the interaction flow instead.',
              status: 400,
            }),
            { status: 400 }
          );
        } catch (error) {
          console.error('[Plans API] Error sending message:', error);
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Failed to send message',
              status: 500,
            }),
            { status: 500 }
          );
        }
      },
    },
  },
});
