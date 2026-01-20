import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { failure, success } from '@/lib/api/response';

export const Route = createFileRoute('/api/plans/$taskId/cancel')({
  server: {
    handlers: {
      /**
       * POST /api/plans/:taskId/cancel - Cancel a plan session
       */
      POST: async ({ params }: { params: { taskId: string } }) => {
        try {
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

          // Cancel the session
          const result = await services.planModeService.cancel(sessionResult.value.id);

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
          console.error('[Plans API] Error cancelling plan session:', error);
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Failed to cancel plan session',
              status: 500,
            }),
            { status: 500 }
          );
        }
      },
    },
  },
});
