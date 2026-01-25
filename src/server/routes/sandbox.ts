/**
 * Sandbox routes (including K8s)
 */

import { Hono } from 'hono';
import {
  getClusterInfo,
  K8S_PROVIDER_DEFAULTS,
  loadKubeConfig,
  resolveContext,
} from '../../lib/sandbox/providers/k8s-config.js';
import type { SandboxConfigService } from '../../services/sandbox-config.service.js';
import { json } from '../shared.js';

interface SandboxDeps {
  sandboxConfigService: SandboxConfigService;
}

export function createSandboxRoutes({ sandboxConfigService }: SandboxDeps) {
  const app = new Hono();

  // GET /api/sandbox-configs
  app.get('/', async (c) => {
    const limit = parseInt(c.req.query('limit') ?? '50', 10);
    const offset = parseInt(c.req.query('offset') ?? '0', 10);

    try {
      const result = await sandboxConfigService.list({ limit, offset });

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({
        ok: true,
        data: {
          items: result.value,
          totalCount: result.value.length,
        },
      });
    } catch (error) {
      console.error('[SandboxConfigs] List error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list sandbox configs' } },
        500
      );
    }
  });

  // POST /api/sandbox-configs
  app.post('/', async (c) => {
    try {
      const body = (await c.req.json()) as {
        name: string;
        description?: string;
        isDefault?: boolean;
        baseImage?: string;
        memoryMb?: number;
        cpuCores?: number;
        maxProcesses?: number;
        timeoutMinutes?: number;
      };

      if (!body.name) {
        return json(
          { ok: false, error: { code: 'MISSING_PARAMS', message: 'Name is required' } },
          400
        );
      }

      const result = await sandboxConfigService.create({
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        baseImage: body.baseImage,
        memoryMb: body.memoryMb,
        cpuCores: body.cpuCores,
        maxProcesses: body.maxProcesses,
        timeoutMinutes: body.timeoutMinutes,
      });

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value }, 201);
    } catch (error) {
      console.error('[SandboxConfigs] Create error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create sandbox config' } },
        500
      );
    }
  });

  // GET /api/sandbox-configs/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      const result = await sandboxConfigService.getById(id);

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[SandboxConfigs] Get error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get sandbox config' } },
        500
      );
    }
  });

  // PATCH /api/sandbox-configs/:id
  app.patch('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      const body = (await c.req.json()) as {
        name?: string;
        description?: string;
        isDefault?: boolean;
        baseImage?: string;
        memoryMb?: number;
        cpuCores?: number;
        maxProcesses?: number;
        timeoutMinutes?: number;
      };

      const result = await sandboxConfigService.update(id, {
        name: body.name,
        description: body.description,
        isDefault: body.isDefault,
        baseImage: body.baseImage,
        memoryMb: body.memoryMb,
        cpuCores: body.cpuCores,
        maxProcesses: body.maxProcesses,
        timeoutMinutes: body.timeoutMinutes,
      });

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[SandboxConfigs] Update error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to update sandbox config' } },
        500
      );
    }
  });

  // DELETE /api/sandbox-configs/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    try {
      const result = await sandboxConfigService.delete(id);

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: null });
    } catch (error) {
      console.error('[SandboxConfigs] Delete error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete sandbox config' } },
        500
      );
    }
  });

  return app;
}

/**
 * Create K8s-specific routes
 */
export function createK8sRoutes() {
  const app = new Hono();

  // GET /api/sandbox/k8s/status
  app.get('/status', async (c) => {
    const kubeconfigPath = c.req.query('kubeconfigPath') ?? undefined;
    const context = c.req.query('context') ?? undefined;

    try {
      // Load kubeconfig
      const kc = loadKubeConfig(kubeconfigPath, true); // skipTLSVerify for local dev

      // Resolve context if specified
      if (context) {
        resolveContext(kc, context);
      }

      // Get cluster info
      const clusterInfo = getClusterInfo(kc);
      const currentContext = kc.getCurrentContext();

      // Try to connect to the cluster
      const k8s = await import('@kubernetes/client-node');
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);

      // Get server version using Node.js https module
      let serverVersion = 'unknown';
      try {
        const cluster = kc.getCurrentCluster();
        if (cluster?.server) {
          const https = await import('node:https');
          const { URL } = await import('node:url');
          const versionUrl = new URL('/version', cluster.server);

          const versionData = await new Promise<{
            gitVersion?: string;
            major?: string;
            minor?: string;
          }>((resolve, reject) => {
            const req = https.request(
              versionUrl,
              {
                method: 'GET',
                rejectUnauthorized: false,
              },
              (res) => {
                let data = '';
                res.on('data', (chunk) => {
                  data += chunk;
                });
                res.on('end', () => {
                  try {
                    resolve(JSON.parse(data));
                  } catch (parseError) {
                    console.debug(
                      '[K8s Status] Failed to parse version response:',
                      parseError instanceof Error ? parseError.message : 'parse error',
                      'data:',
                      data.substring(0, 100)
                    );
                    reject(new Error('Invalid JSON response from K8s version endpoint'));
                  }
                });
              }
            );
            req.on('error', reject);
            req.end();
          });

          serverVersion = versionData.gitVersion || `v${versionData.major}.${versionData.minor}`;
        }
      } catch (versionError) {
        console.debug(
          '[K8s Status] Version fetch failed:',
          versionError instanceof Error ? versionError.message : versionError
        );
      }

      // Check namespace
      const namespace = K8S_PROVIDER_DEFAULTS.namespace;
      let namespaceExists = false;
      let pods = 0;
      let podsRunning = 0;

      try {
        await coreApi.readNamespace({ name: namespace });
        namespaceExists = true;

        // Count pods in namespace
        const podList = await coreApi.listNamespacedPod({ namespace });
        pods = podList.items.length;
        podsRunning = podList.items.filter((p) => p.status?.phase === 'Running').length;
      } catch (error) {
        // Check if this is a 404 (namespace doesn't exist) vs other errors
        const statusCode = (error as { response?: { statusCode?: number } }).response?.statusCode;
        if (statusCode === 404) {
          // Namespace doesn't exist yet - this is expected
          console.debug('[K8s Status] Namespace does not exist yet:', namespace);
        } else {
          // Log other errors (auth failures, network issues, etc.)
          console.error(
            '[K8s Status] Namespace check failed:',
            error instanceof Error ? error.message : error
          );
        }
      }

      return json({
        ok: true,
        data: {
          healthy: true,
          context: currentContext,
          cluster: clusterInfo?.name,
          server: clusterInfo?.server,
          serverVersion,
          namespace,
          namespaceExists,
          pods,
          podsRunning,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect to cluster';
      console.error('[K8s Status] Error:', message);
      return json({
        ok: true,
        data: {
          healthy: false,
          message,
        },
      });
    }
  });

  // GET /api/sandbox/k8s/contexts
  app.get('/contexts', async (c) => {
    const kubeconfigPath = c.req.query('kubeconfigPath') ?? undefined;

    try {
      const kc = loadKubeConfig(kubeconfigPath);
      const contexts = kc.getContexts();
      const currentContext = kc.getCurrentContext();

      return json({
        ok: true,
        data: {
          contexts: contexts.map((ctx) => ({
            name: ctx.name,
            cluster: ctx.cluster,
            user: ctx.user,
            namespace: ctx.namespace,
          })),
          current: currentContext,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load kubeconfig';
      console.error('[K8s Contexts] Error:', message);
      return json(
        {
          ok: false,
          error: { code: 'K8S_CONFIG_ERROR', message },
        },
        400
      );
    }
  });

  // GET /api/sandbox/k8s/namespaces
  app.get('/namespaces', async (c) => {
    const kubeconfigPath = c.req.query('kubeconfigPath') ?? undefined;
    const context = c.req.query('context') ?? undefined;
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    try {
      const kc = loadKubeConfig(kubeconfigPath, true);

      if (context) {
        resolveContext(kc, context);
      }

      const k8s = await import('@kubernetes/client-node');
      const coreApi = kc.makeApiClient(k8s.CoreV1Api);

      const namespaceList = await coreApi.listNamespace({ limit });

      return json({
        ok: true,
        data: {
          namespaces: namespaceList.items.map((ns) => ({
            name: ns.metadata?.name,
            status: ns.status?.phase,
            createdAt: ns.metadata?.creationTimestamp,
          })),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to list namespaces';
      console.error('[K8s Namespaces] Error:', message);
      return json(
        {
          ok: false,
          error: { code: 'K8S_API_ERROR', message },
        },
        500
      );
    }
  });

  return app;
}
