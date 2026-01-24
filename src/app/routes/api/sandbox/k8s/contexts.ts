import { createFileRoute } from '@tanstack/react-router';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { k8sContextsQuerySchema } from '@/lib/api/schemas';
import { parseQuery } from '@/lib/api/validation';
import { K8sErrors } from '@/lib/errors/k8s-errors';

export interface K8sContext {
  /** Context name */
  name: string;
  /** Cluster name */
  cluster: string;
  /** User name */
  user: string;
  /** Namespace (if set in context) */
  namespace?: string;
}

export const Route = createFileRoute('/api/sandbox/k8s/contexts')({
  server: {
    handlers: {
      /**
       * GET /api/sandbox/k8s/contexts
       *
       * Returns the list of available Kubernetes contexts from kubeconfig.
       * Optional query params:
       * - kubeconfigPath: Path to kubeconfig file
       */
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, k8sContextsQuerySchema);

        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        try {
          // Dynamic import for server-side-only K8s client
          const { loadKubeConfig } = await import('@/lib/sandbox/providers/k8s-config');

          const kc = loadKubeConfig(parsed.value.kubeconfigPath);

          const contexts = kc.getContexts();
          const currentContext = kc.getCurrentContext();

          const contextList: K8sContext[] = contexts.map((ctx) => ({
            name: ctx.name,
            cluster: ctx.cluster,
            user: ctx.user,
            namespace: ctx.namespace,
          }));

          return Response.json(
            success({
              current: currentContext,
              contexts: contextList,
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
          return Response.json(failure(K8sErrors.KUBECONFIG_INVALID(message)), {
            status: 500,
          });
        }
      }),
    },
  },
});
