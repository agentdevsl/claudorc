import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';

export const Route = createFileRoute('/api/templates/$id/sync')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ context }) => {
        const { templateService } = getApiServicesOrThrow();
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Template id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await templateService.sync(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
