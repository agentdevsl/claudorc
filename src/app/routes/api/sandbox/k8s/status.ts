import { createFileRoute } from '@tanstack/react-router';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { k8sStatusQuerySchema } from '@/lib/api/schemas';
import { parseQuery } from '@/lib/api/validation';
import { K8sErrors } from '@/lib/errors/k8s-errors';

export const Route = createFileRoute('/api/sandbox/k8s/status')({
  server: {
    handlers: {
      /**
       * GET /api/sandbox/k8s/status
       *
       * Returns the health status of the Kubernetes cluster.
       * Optional query params:
       * - kubeconfigPath: Path to kubeconfig file
       * - context: K8s context to use
       */
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, k8sStatusQuerySchema);

        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        try {
          // Dynamic import for server-side-only K8s client
          const { createK8sProvider } = await import('@/lib/sandbox/providers/k8s-provider');

          const provider = createK8sProvider({
            kubeconfigPath: parsed.value.kubeconfigPath,
            context: parsed.value.context,
          });

          const healthCheck = await provider.healthCheck();

          return Response.json(
            success({
              healthy: healthCheck.healthy,
              message: healthCheck.message,
              context: healthCheck.details?.context,
              cluster: healthCheck.details?.cluster,
              server: healthCheck.details?.server,
              serverVersion: healthCheck.details?.serverVersion,
              namespace: healthCheck.details?.namespace,
              namespaceExists: healthCheck.details?.namespaceExists,
              pods: healthCheck.details?.pods,
              podsRunning: healthCheck.details?.podsRunning,
            })
          );
        } catch (error) {
          // Handle K8s-specific errors
          if (error && typeof error === 'object' && 'code' in error) {
            const appError = error as { code: string; message: string; status: number };
            if (appError.code.startsWith('K8S_')) {
              return Response.json(failure(appError as Parameters<typeof failure>[0]), {
                status: appError.status,
              });
            }
          }

          const message = error instanceof Error ? error.message : String(error);
          return Response.json(failure(K8sErrors.CLUSTER_UNREACHABLE(message)), {
            status: 503,
          });
        }
      }),
    },
  },
});
