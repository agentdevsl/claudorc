import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';

const { agentService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/agents/$id/stop')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await agentService.stop(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success({ stopped: true }));
      }),
    },
  },
});
