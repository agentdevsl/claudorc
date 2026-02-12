/**
 * Sandbox routes (including K8s)
 */

import {
  AgentSandboxClient,
  getClusterInfo,
  loadKubeConfig,
  resolveContext,
} from '@agentpane/agent-sandbox-sdk';
import { Hono } from 'hono';
import type { SandboxConfigService } from '../../services/sandbox-config.service.js';
import type { Database } from '../../types/database.js';
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
 * Validate kubeconfigPath to prevent path traversal attacks.
 * Only allows paths under the user's home directory or standard kubeconfig locations.
 */
function validateKubeconfigPath(path: string | undefined): string | undefined {
  if (!path) return undefined;

  // Reject path traversal attempts
  if (path.includes('..')) {
    throw new Error('Invalid kubeconfig path: path traversal not allowed');
  }

  // Only allow paths that look like kubeconfig files
  const normalized = path.startsWith('~/') ? path.replace('~', process.env.HOME ?? '') : path;

  // Must be under home directory or /etc/kubernetes or /var/run
  const homeDir = process.env.HOME ?? '/home';
  const allowedPrefixes = [homeDir, '/etc/kubernetes', '/var/run/secrets/kubernetes.io'];

  if (!allowedPrefixes.some((prefix) => normalized.startsWith(prefix))) {
    throw new Error(
      'Invalid kubeconfig path: must be under home directory or standard K8s config location'
    );
  }

  return path;
}

/**
 * Create K8s-specific routes
 */
export function createK8sRoutes(deps?: { db?: Database }) {
  const app = new Hono();

  // GET /api/sandbox/k8s/status
  app.get('/status', async (c) => {
    const context = c.req.query('context') ?? undefined;

    let kubeconfigPath: string | undefined;
    try {
      kubeconfigPath = validateKubeconfigPath(c.req.query('kubeconfigPath') ?? undefined);
    } catch (error) {
      return json(
        {
          ok: false,
          error: {
            code: 'INVALID_KUBECONFIG_PATH',
            message: error instanceof Error ? error.message : 'Invalid kubeconfig path',
          },
        },
        400
      );
    }

    try {
      // Load kubeconfig
      const kc = loadKubeConfig({ kubeconfigPath, skipTLSVerify: true }); // skipTLSVerify for local dev

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
      const namespace = 'agentpane-sandboxes';
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
      return json(
        {
          ok: false,
          error: {
            code: 'K8S_CONNECTION_ERROR',
            message,
          },
        },
        500
      );
    }
  });

  // GET /api/sandbox/k8s/contexts
  app.get('/contexts', async (c) => {
    let kubeconfigPath: string | undefined;
    try {
      kubeconfigPath = validateKubeconfigPath(c.req.query('kubeconfigPath') ?? undefined);
    } catch (error) {
      return json(
        {
          ok: false,
          error: {
            code: 'INVALID_KUBECONFIG_PATH',
            message: error instanceof Error ? error.message : 'Invalid kubeconfig path',
          },
        },
        400
      );
    }

    try {
      const kc = loadKubeConfig({ kubeconfigPath });
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
    let kubeconfigPath: string | undefined;
    try {
      kubeconfigPath = validateKubeconfigPath(c.req.query('kubeconfigPath') ?? undefined);
    } catch (error) {
      return json(
        {
          ok: false,
          error: {
            code: 'INVALID_KUBECONFIG_PATH',
            message: error instanceof Error ? error.message : 'Invalid kubeconfig path',
          },
        },
        400
      );
    }

    const context = c.req.query('context') ?? undefined;
    const limit = parseInt(c.req.query('limit') ?? '50', 10);

    try {
      const kc = loadKubeConfig({ kubeconfigPath, skipTLSVerify: true });

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

  // GET /api/sandbox/k8s/controller - CRD controller installation status
  app.get('/controller', async (c) => {
    try {
      // Load K8s settings from query params or defaults
      let namespace = 'agentpane-sandboxes';
      let kubeconfigPath: string | undefined = c.req.query('kubeconfigPath') ?? undefined;
      let kubeContext: string | undefined = c.req.query('context') ?? undefined;

      // Also try loading from DB settings if available
      if (deps?.db && !kubeconfigPath && !kubeContext) {
        try {
          const { eq } = await import('drizzle-orm');
          const { settings } = await import('../../db/schema/sqlite/index.js');
          const k8sSetting = await deps.db.query.settings.findFirst({
            where: eq(settings.key, 'sandbox.kubernetes'),
          });
          if (k8sSetting?.value) {
            const parsed = JSON.parse(k8sSetting.value);
            namespace = parsed.namespace ?? namespace;
            kubeconfigPath = parsed.kubeConfigPath;
            kubeContext = parsed.kubeContext;
          }
        } catch {
          // Use defaults
        }
      }

      // Create a temporary SDK client to check controller status
      const client = new AgentSandboxClient({
        namespace,
        kubeconfigPath,
        context: kubeContext,
      });

      const health = await client.healthCheck();

      return json({
        ok: true,
        data: {
          installed: health.controllerInstalled,
          version: health.controllerVersion ?? null,
          crdRegistered: health.crdRegistered,
          crdGroup: 'agents.x-k8s.io',
          crdApiVersion: 'v1alpha1',
          clusterVersion: health.clusterVersion ?? null,
          ready: health.healthy,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[K8s Controller] Error:', message);
      return json(
        {
          ok: false,
          error: {
            code: 'K8S_CONTROLLER_ERROR',
            message: `Failed to check CRD controller: ${message}`,
          },
        },
        500
      );
    }
  });

  return app;
}
