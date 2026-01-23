import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SandboxConfig } from '../../types.js';

// Define mock types
interface MockCoreApi {
  createNamespace: ReturnType<typeof vi.fn>;
  readNamespace: ReturnType<typeof vi.fn>;
  listNamespace: ReturnType<typeof vi.fn>;
  createNamespacedPod: ReturnType<typeof vi.fn>;
  readNamespacedPod: ReturnType<typeof vi.fn>;
  deleteNamespacedPod: ReturnType<typeof vi.fn>;
  listNamespacedPod: ReturnType<typeof vi.fn>;
}

interface MockVersionApi {
  getCode: ReturnType<typeof vi.fn>;
}

// Shared mock instances
let mockCoreApi: MockCoreApi;
let mockVersionApi: MockVersionApi;

const initMocks = () => {
  mockCoreApi = {
    createNamespace: vi.fn(),
    readNamespace: vi.fn(),
    listNamespace: vi.fn(() => Promise.resolve({ items: [] })),
    createNamespacedPod: vi.fn(),
    readNamespacedPod: vi.fn(),
    deleteNamespacedPod: vi.fn(),
    listNamespacedPod: vi.fn(() => Promise.resolve({ items: [] })),
  };
  mockVersionApi = {
    getCode: vi.fn(() => Promise.resolve({ gitVersion: 'v1.28.0' })),
  };
};

initMocks();

// Mock @kubernetes/client-node
vi.mock('@kubernetes/client-node', () => {
  class MockKubeConfig {
    loadFromFile = vi.fn();
    loadFromCluster = vi.fn();
    getCurrentContext = vi.fn(() => 'minikube');
    getContexts = vi.fn(() => [{ name: 'minikube', cluster: 'minikube' }]);
    getContextObject = vi.fn(() => ({ cluster: 'minikube' }));
    getCluster = vi.fn(() => ({ server: 'https://127.0.0.1:6443' }));
    setCurrentContext = vi.fn();
    makeApiClient = vi.fn((ApiClass: { name?: string }) => {
      if (ApiClass?.name === 'CoreV1Api') return mockCoreApi;
      if (ApiClass?.name === 'VersionApi') return mockVersionApi;
      return {};
    });
  }

  return {
    KubeConfig: MockKubeConfig,
    CoreV1Api: class CoreV1Api { static name = 'CoreV1Api'; },
    VersionApi: class VersionApi { static name = 'VersionApi'; },
    Exec: vi.fn(),
    V1Status: vi.fn(),
  };
});

// Mock the k8s-config module to avoid fs operations
vi.mock('../k8s-config.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../k8s-config.js')>();
  const k8s = await import('@kubernetes/client-node');

  return {
    ...actual,
    loadKubeConfig: vi.fn(() => new k8s.KubeConfig()),
  };
});

// Import after mocks
import { K8S_POD_LABELS, K8S_PROVIDER_DEFAULTS } from '../k8s-config.js';
import { K8sProvider, createK8sProvider } from '../k8s-provider.js';

describe('K8sProvider', () => {
  const sampleConfig: SandboxConfig = {
    projectId: 'proj-123',
    projectPath: '/home/user/project',
    image: 'node:22-slim',
    memoryMb: 4096,
    cpuCores: 2,
    idleTimeoutMinutes: 30,
    volumeMounts: [],
    env: { NODE_ENV: 'development' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    initMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('creates provider with default options', () => {
      const provider = createK8sProvider();
      expect(provider.name).toBe('kubernetes');
    });

    it('creates provider with custom namespace', () => {
      const provider = new K8sProvider({ namespace: 'custom-ns' });
      expect(provider.name).toBe('kubernetes');
    });
  });

  describe('create', () => {
    it('creates pod with correct labels', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123', name: 'agentpane-proj-123-abc' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: {
          phase: 'Running',
          containerStatuses: [{ ready: true }],
        },
      });

      const sandbox = await provider.create(sampleConfig);

      expect(sandbox.id).toBeDefined();
      expect(sandbox.projectId).toBe('proj-123');
      expect(sandbox.status).toBe('running');

      expect(mockCoreApi.createNamespacedPod).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: K8S_PROVIDER_DEFAULTS.namespace,
          body: expect.objectContaining({
            metadata: expect.objectContaining({
              labels: expect.objectContaining({
                [K8S_POD_LABELS.sandbox]: 'true',
                [K8S_POD_LABELS.projectId]: 'proj-123',
              }),
            }),
          }),
        })
      );
    });

    it('creates namespace if it does not exist', async () => {
      const provider = createK8sProvider({ createNamespace: true });

      mockCoreApi.readNamespace.mockRejectedValue({
        response: { statusCode: 404 },
      });
      mockCoreApi.createNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(sampleConfig);

      expect(mockCoreApi.createNamespace).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.objectContaining({
            metadata: expect.objectContaining({
              name: K8S_PROVIDER_DEFAULTS.namespace,
            }),
          }),
        })
      );
    });

    it('throws error when namespace does not exist and createNamespace is false', async () => {
      const provider = createK8sProvider({ createNamespace: false });

      mockCoreApi.readNamespace.mockRejectedValue({
        response: { statusCode: 404 },
      });

      await expect(provider.create(sampleConfig)).rejects.toMatchObject({
        code: 'K8S_NAMESPACE_NOT_FOUND',
      });
    });

    it('throws error when pod already exists for project', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(sampleConfig);

      await expect(provider.create(sampleConfig)).rejects.toMatchObject({
        code: 'K8S_POD_ALREADY_EXISTS',
      });
    });

    it('throws error on ImagePullBackOff', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        spec: { containers: [{ image: 'nonexistent:latest' }] },
        status: {
          phase: 'Pending',
          containerStatuses: [{
            state: {
              waiting: {
                reason: 'ImagePullBackOff',
                message: 'Back-off pulling image',
              },
            },
          }],
        },
      });

      await expect(provider.create(sampleConfig)).rejects.toMatchObject({
        code: 'K8S_IMAGE_PULL_BACKOFF',
      });
    });

    it('builds correct volume mounts', async () => {
      const provider = createK8sProvider();

      const configWithVolumes: SandboxConfig = {
        ...sampleConfig,
        volumeMounts: [
          { hostPath: '/host/data', containerPath: '/data', readonly: true },
          { hostPath: '/host/cache', containerPath: '/cache' },
        ],
      };

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(configWithVolumes);

      const podSpec = mockCoreApi.createNamespacedPod.mock.calls[0]?.[0]?.body;
      expect(podSpec?.spec?.volumes).toHaveLength(3);
      expect(podSpec?.spec?.containers?.[0]?.volumeMounts).toHaveLength(3);
    });

    it('sets resource limits correctly', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(sampleConfig);

      const podSpec = mockCoreApi.createNamespacedPod.mock.calls[0]?.[0]?.body;
      expect(podSpec?.spec?.containers?.[0]?.resources?.limits).toEqual({
        memory: '4096Mi',
        cpu: '2',
      });
    });
  });

  describe('get', () => {
    it('returns null for nonexistent project', async () => {
      const provider = createK8sProvider();
      const result = await provider.get('nonexistent');
      expect(result).toBeNull();
    });

    it('returns sandbox for existing project', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      const created = await provider.create(sampleConfig);
      const retrieved = await provider.get(sampleConfig.projectId);

      expect(retrieved).toBe(created);
    });
  });

  describe('getById', () => {
    it('returns null for nonexistent sandbox', async () => {
      const provider = createK8sProvider();
      const result = await provider.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('returns sandbox by id', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      const created = await provider.create(sampleConfig);
      const retrieved = await provider.getById(created.id);

      expect(retrieved).toBe(created);
    });
  });

  describe('list', () => {
    it('returns empty list when no sandboxes', async () => {
      const provider = createK8sProvider();
      const list = await provider.list();
      expect(list).toEqual([]);
    });

    it('returns list of sandbox infos', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(sampleConfig);
      const list = await provider.list();

      expect(list).toHaveLength(1);
      expect(list[0]?.projectId).toBe('proj-123');
      expect(list[0]?.status).toBe('running');
    });
  });

  describe('healthCheck', () => {
    it('returns healthy when cluster is accessible', async () => {
      const provider = createK8sProvider();

      mockCoreApi.listNamespace.mockResolvedValue({ items: [] });
      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [] });

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details?.provider).toBe('kubernetes');
      expect(health.details?.context).toBe('minikube');
    });

    it('returns unhealthy when cluster is unreachable', async () => {
      const provider = createK8sProvider();

      mockCoreApi.listNamespace.mockRejectedValue(new Error('connection refused'));

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(false);
      expect(health.message).toContain('connection refused');
    });

    it('indicates when namespace does not exist', async () => {
      const provider = createK8sProvider();

      mockCoreApi.listNamespace.mockResolvedValue({ items: [] });
      mockCoreApi.readNamespace.mockRejectedValue({ response: { statusCode: 404 } });

      const health = await provider.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.details?.namespaceExists).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('cleans up stopped sandboxes', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });
      mockCoreApi.deleteNamespacedPod.mockResolvedValue({});

      const sandbox = await provider.create(sampleConfig);
      await sandbox.stop();

      const cleaned = await provider.cleanup();
      expect(cleaned).toBe(1);

      const list = await provider.list();
      expect(list).toHaveLength(0);
    });

    it('respects olderThan filter', async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });
      mockCoreApi.deleteNamespacedPod.mockResolvedValue({});

      const sandbox = await provider.create(sampleConfig);
      await sandbox.stop();

      const futureDate = new Date(Date.now() + 10000);
      const cleaned = await provider.cleanup({ olderThan: futureDate });
      expect(cleaned).toBe(1);
    });
  });

  describe('events', () => {
    it('emits sandbox:creating and sandbox:created events', async () => {
      const provider = createK8sProvider();
      const events: { type: string }[] = [];

      provider.on((event) => {
        events.push(event);
      });

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      await provider.create(sampleConfig);

      expect(events.map((e) => e.type)).toContain('sandbox:creating');
      expect(events.map((e) => e.type)).toContain('sandbox:created');
      expect(events.map((e) => e.type)).toContain('sandbox:started');
    });

    it('emits sandbox:error on failure', async () => {
      const provider = createK8sProvider();
      const events: { type: string }[] = [];

      provider.on((event) => {
        events.push(event);
      });

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockRejectedValue(new Error('API error'));

      await expect(provider.create(sampleConfig)).rejects.toThrow();

      expect(events.map((e) => e.type)).toContain('sandbox:error');
    });

    it('allows removing event listeners', () => {
      const provider = createK8sProvider();
      const listener = vi.fn();

      const unsubscribe = provider.on(listener);
      unsubscribe();
    });
  });

  describe('K8sSandbox tmux operations', () => {
    // Helper to create a sandbox for tmux tests
    const createTestSandbox = async () => {
      const provider = createK8sProvider();

      mockCoreApi.readNamespace.mockResolvedValue({});
      mockCoreApi.createNamespacedPod.mockResolvedValue({
        metadata: { uid: 'pod-uid-123' },
      });
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: { phase: 'Running', containerStatuses: [{ ready: true }] },
      });

      return provider.create(sampleConfig);
    };

    // Note: These tests verify the interface and error handling.
    // The actual exec() calls are tested through the K8s Exec mock.
    // Integration tests with a real cluster would test actual tmux behavior.

    it('sandbox has tmux session methods', async () => {
      const sandbox = await createTestSandbox();

      expect(sandbox.createTmuxSession).toBeDefined();
      expect(sandbox.listTmuxSessions).toBeDefined();
      expect(sandbox.killTmuxSession).toBeDefined();
      expect(sandbox.sendKeysToTmux).toBeDefined();
      expect(sandbox.captureTmuxPane).toBeDefined();
    });

    it('sandbox has exec methods', async () => {
      const sandbox = await createTestSandbox();

      expect(sandbox.exec).toBeDefined();
      expect(sandbox.execAsRoot).toBeDefined();
    });

    it('sandbox has lifecycle methods', async () => {
      const sandbox = await createTestSandbox();

      expect(sandbox.stop).toBeDefined();
      expect(sandbox.getMetrics).toBeDefined();
      expect(sandbox.touch).toBeDefined();
      expect(sandbox.getLastActivity).toBeDefined();
    });

    it('touch updates last activity time', async () => {
      const sandbox = await createTestSandbox();

      const before = sandbox.getLastActivity();
      await new Promise((resolve) => setTimeout(resolve, 10));
      sandbox.touch();
      const after = sandbox.getLastActivity();

      expect(after.getTime()).toBeGreaterThan(before.getTime());
    });

    it('stop deletes the pod', async () => {
      const sandbox = await createTestSandbox();
      mockCoreApi.deleteNamespacedPod.mockResolvedValue({});

      await sandbox.stop();

      expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: K8S_PROVIDER_DEFAULTS.namespace,
          gracePeriodSeconds: 10,
        })
      );
      expect(sandbox.status).toBe('stopped');
    });

    it('stop throws on deletion failure', async () => {
      const sandbox = await createTestSandbox();
      mockCoreApi.deleteNamespacedPod.mockRejectedValue(new Error('Delete failed'));

      await expect(sandbox.stop()).rejects.toMatchObject({
        code: 'K8S_POD_DELETION_FAILED',
      });
      expect(sandbox.status).toBe('error');
    });

    it('getMetrics returns metrics object', async () => {
      const sandbox = await createTestSandbox();
      mockCoreApi.readNamespacedPod.mockResolvedValue({
        status: {
          containerStatuses: [{
            name: 'sandbox',
            state: {
              running: {
                startedAt: new Date(Date.now() - 60000).toISOString(),
              },
            },
          }],
        },
      });

      const metrics = await sandbox.getMetrics();

      expect(metrics).toHaveProperty('cpuUsagePercent');
      expect(metrics).toHaveProperty('memoryUsageMb');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics.uptime).toBeGreaterThan(0);
    });
  });
});
