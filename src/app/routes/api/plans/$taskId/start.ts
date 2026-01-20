import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { failure, success } from '@/lib/api/response';

export const Route = createFileRoute('/api/plans/$taskId/start')({
  server: {
    handlers: {
      /**
       * POST /api/plans/:taskId/start - Start a new plan session
       */
      POST: async ({ params, request }: { params: { taskId: string }; request: Request }) => {
        try {
          const body = await request.json();
          const { projectId, initialPrompt } = body as {
            projectId: string;
            initialPrompt: string;
          };

          if (!projectId || !initialPrompt) {
            return Response.json(
              failure({
                code: 'VALIDATION_ERROR',
                message: 'Missing required fields: projectId, initialPrompt',
                status: 400,
              }),
              { status: 400 }
            );
          }

          const services = getApiServicesOrThrow();

          const result = await services.planModeService.start({
            taskId: params.taskId,
            projectId,
            initialPrompt,
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

          return Response.json(success({ session: result.value }), { status: 201 });
        } catch (error) {
          console.error('[Plans API] Error starting plan session:', error);
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: error instanceof Error ? error.message : 'Failed to start plan session',
              status: 500,
            }),
            { status: 500 }
          );
        }
      },
    },
  },
});
