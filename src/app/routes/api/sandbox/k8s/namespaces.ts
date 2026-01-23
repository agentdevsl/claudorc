import { createFileRoute } from '@tanstack/react-router';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { k8sNamespacesQuerySchema } from '@/lib/api/schemas';
import { parseQuery } from '@/lib/api/validation';
import { K8sErrors } from '@/lib/errors/k8s-errors';

export interface K8sNamespace {
  /** Namespace name */
  name: string;
  /** Namespace status (Active, Terminating) */
  status: string;
  /** Creation timestamp */
  createdAt: string;
  /** Labels on the namespace */
  labels?: Record<string, string>;
}

export const Route = createFileRoute('/api/sandbox/k8s/namespaces')({
  server: {
    handlers: {
      /**
       * GET /api/sandbox/k8s/namespaces
       *
       * Returns the list of namespaces in the Kubernetes cluster.
       * Optional query params:
       * - kubeconfigPath: Path to kubeconfig file
       * - context: K8s context to use
       * - limit: Maximum number of namespaces to return (default: 50)
       */
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, k8sNamespacesQuerySchema);

        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        try {
          // Dynamic imports for server-side-only K8s client
          const k8s = await import('@kubernetes/client-node');
          const { loadKubeConfig, resolveContext } = await import(
            '@/lib/sandbox/providers/k8s-config'
          );

          const kc = loadKubeConfig(parsed.value.kubeconfigPath);

          // Set context if specified
          if (parsed.value.context) {
            resolveContext(kc, parsed.value.context);
          }

          const coreApi = kc.makeApiClient(k8s.CoreV1Api);

          const response = await coreApi.listNamespace({
            limit: parsed.value.limit,
          });

          const namespaces: K8sNamespace[] = response.items.map((ns) => ({
            name: ns.metadata?.name ?? 'unknown',
            status: ns.status?.phase ?? 'Unknown',
            createdAt: ns.metadata?.creationTimestamp?.toISOString() ?? new Date().toISOString(),
            labels: ns.metadata?.labels as Record<string, string> | undefined,
          }));

          return Response.json(
            success({
              namespaces,
              total: namespaces.length,
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
