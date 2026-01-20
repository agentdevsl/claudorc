import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { failure, success } from '@/lib/api/response';

export const Route = createFileRoute('/api/plans/$taskId')({
  server: {
    handlers: {
      /**
       * GET /api/plans/:taskId - Get plan session for a task
       */
      GET: async ({ params }: { params: { taskId: string } }) => {
        try {
          const services = getApiServicesOrThrow();
          const result = await services.planModeService.getByTaskId(params.taskId);

          if (!result.ok) {
            return Response.json(
              failure({
                code: 'SESSION_NOT_FOUND',
                message: 'Failed to get plan session',
                status: 404,
              }),
              { status: 404 }
            );
          }

          return Response.json(success({ session: result.value }));
        } catch (error) {
          console.error('[Plans API] Error getting plan session:', error);
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Failed to get plan session',
              status: 500,
            }),
            { status: 500 }
          );
        }
      },
    },
  },
});
