import type * as k8s from '@kubernetes/client-node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createWarmPoolController,
  K8S_WARM_POOL_LABELS,
  WARM_POOL_DEFAULTS,
  WarmPoolController,
} from '../k8s-warm-pool.js';

// Mock the audit logger
vi.mock('../k8s-audit.js', () => ({
  getK8sAuditLogger: () => ({
    log: vi.fn(),
    setEnabled: vi.fn(),
    logWarmPoolPrewarm: vi.fn(),
    logWarmPoolAllocation: vi.fn(),
    logWarmPoolPodCreated: vi.fn(),
    logWarmPoolPodDeleted: vi.fn(),
    logWarmPoolDiscovery: vi.fn(),
  }),
}));

// Mock K8s API responses
const mockPod = (
  name: string,
  state: 'warm' | 'allocated' = 'warm',
  projectId?: string
): k8s.V1Pod => ({
  apiVersion: 'v1',
  kind: 'Pod',
  metadata: {
    name,
    namespace: 'agentpane-sandboxes',
    uid: `uid-${name}`,
    creationTimestamp: new Date(),
    labels: {
      'agentpane.io/sandbox': 'true',
      'agentpane.io/warm-pool': 'true',
      'agentpane.io/warm-pool-state': state,
      ...(projectId && { 'agentpane.io/project-id': projectId }),
    },
  },
  status: {
    phase: 'Running',
    containerStatuses: [
      {
        name: 'sandbox',
        ready: true,
        restartCount: 0,
        image: 'test-image',
        imageID: 'test-image-id',
      },
    ],
  },
});

describe('WarmPoolController', () => {
  let mockCoreApi: {
    createNamespacedPod: ReturnType<typeof vi.fn>;
    deleteNamespacedPod: ReturnType<typeof vi.fn>;
    readNamespacedPod: ReturnType<typeof vi.fn>;
    listNamespacedPod: ReturnType<typeof vi.fn>;
    patchNamespacedPod: ReturnType<typeof vi.fn>;
  };
  let controller: WarmPoolController;

  beforeEach(() => {
    mockCoreApi = {
      createNamespacedPod: vi.fn(),
      deleteNamespacedPod: vi.fn(),
      readNamespacedPod: vi.fn(),
      listNamespacedPod: vi.fn(),
      patchNamespacedPod: vi.fn(),
    };

    // Default mock implementations
    mockCoreApi.listNamespacedPod.mockResolvedValue({ items: [] });
    mockCoreApi.createNamespacedPod.mockImplementation(({ body }) => {
      const podName = body.metadata?.name ?? 'test-pod';
      return Promise.resolve({
        metadata: { name: podName, uid: `uid-${podName}` },
      });
    });
    mockCoreApi.readNamespacedPod.mockImplementation(({ name }) => Promise.resolve(mockPod(name)));
    mockCoreApi.deleteNamespacedPod.mockResolvedValue({});
    mockCoreApi.patchNamespacedPod.mockResolvedValue({});

    controller = createWarmPoolController(
      mockCoreApi as unknown as k8s.CoreV1Api,
      'agentpane-sandboxes',
      { minSize: 2, maxSize: 5, replenishIntervalMs: 60000, enableAutoScaling: false }
    );
  });

  afterEach(async () => {
    // Stop the controller to prevent interval leaks
    await controller.stop();
    vi.clearAllMocks();
  });

  describe('createWarmPoolController', () => {
    it('creates controller with default config', () => {
      const ctrl = createWarmPoolController(mockCoreApi as unknown as k8s.CoreV1Api);
      expect(ctrl).toBeInstanceOf(WarmPoolController);
    });

    it('creates controller with custom config', () => {
      const ctrl = createWarmPoolController(
        mockCoreApi as unknown as k8s.CoreV1Api,
        'custom-namespace',
        { minSize: 5, maxSize: 20 }
      );
      expect(ctrl).toBeInstanceOf(WarmPoolController);
      const metrics = ctrl.getMetrics();
      expect(metrics.config.minSize).toBe(5);
      expect(metrics.config.maxSize).toBe(20);
    });
  });

  describe('K8S_WARM_POOL_LABELS', () => {
    it('exports expected labels', () => {
      expect(K8S_WARM_POOL_LABELS.warmPool).toBe('agentpane.io/warm-pool');
      expect(K8S_WARM_POOL_LABELS.warmPoolState).toBe('agentpane.io/warm-pool-state');
      expect(K8S_WARM_POOL_LABELS.poolId).toBe('agentpane.io/pool-id');
    });
  });

  describe('WARM_POOL_DEFAULTS', () => {
    it('exports expected defaults', () => {
      expect(WARM_POOL_DEFAULTS.minSize).toBe(2);
      expect(WARM_POOL_DEFAULTS.maxSize).toBe(10);
      expect(WARM_POOL_DEFAULTS.enableAutoScaling).toBe(true);
      expect(WARM_POOL_DEFAULTS.scaleUpThreshold).toBe(0.8);
      expect(WARM_POOL_DEFAULTS.scaleDownThreshold).toBe(0.2);
    });
  });

  describe('start()', () => {
    it('discovers existing pods on start', async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValueOnce({
        items: [mockPod('existing-warm-1'), mockPod('existing-warm-2')],
      });

      await controller.start();

      expect(mockCoreApi.listNamespacedPod).toHaveBeenCalledWith(
        expect.objectContaining({
          namespace: 'agentpane-sandboxes',
          labelSelector: 'agentpane.io/warm-pool=true',
        })
      );

      const metrics = controller.getMetrics();
      expect(metrics.warmPods).toBe(2);
    });

    it('replenishes pool to minSize on start', async () => {
      await controller.start();

      // Should create 2 pods (minSize)
      expect(mockCoreApi.createNamespacedPod).toHaveBeenCalledTimes(2);
    });
  });

  describe('stop()', () => {
    it('deletes warm pods on stop', async () => {
      await controller.start();
      const initialMetrics = controller.getMetrics();
      expect(initialMetrics.warmPods).toBe(2);

      await controller.stop();

      // Should delete the 2 warm pods
      expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledTimes(2);
    });
  });

  describe('prewarm()', () => {
    it('creates specified number of pods', async () => {
      const created = await controller.prewarm(3);

      expect(created).toBe(3);
      expect(mockCoreApi.createNamespacedPod).toHaveBeenCalledTimes(3);
    });

    it('respects maxSize limit', async () => {
      // Pool max is 5, create 3 first
      await controller.prewarm(3);

      // Try to create 5 more (should only create 2)
      const created = await controller.prewarm(5);

      expect(created).toBe(2);
    });

    it('creates pods with correct labels', async () => {
      await controller.prewarm(1);

      const createCall = mockCoreApi.createNamespacedPod.mock.calls[0]?.[0] as {
        body?: {
          metadata?: { labels?: Record<string, string> };
          spec?: {
            securityContext?: Record<string, unknown>;
            containers?: Array<{ securityContext?: Record<string, unknown> }>;
          };
        };
      };
      const labels = createCall?.body?.metadata?.labels;

      expect(labels?.['agentpane.io/sandbox']).toBe('true');
      expect(labels?.['agentpane.io/warm-pool']).toBe('true');
      expect(labels?.['agentpane.io/warm-pool-state']).toBe('warm');
      expect(labels?.['agentpane.io/pool-id']).toBeDefined();
    });

    it('creates pods with security context', async () => {
      await controller.prewarm(1);

      const createCall = mockCoreApi.createNamespacedPod.mock.calls[0]?.[0] as {
        body?: {
          spec?: {
            securityContext?: Record<string, unknown>;
            containers?: Array<{ securityContext?: Record<string, unknown> }>;
          };
        };
      };
      const spec = createCall?.body?.spec;

      expect(spec?.securityContext?.runAsNonRoot).toBe(true);
      expect(spec?.securityContext?.runAsUser).toBe(1000);
      expect(spec?.containers?.[0]?.securityContext?.allowPrivilegeEscalation).toBe(false);
    });
  });

  describe('getWarm()', () => {
    beforeEach(async () => {
      await controller.prewarm(2);
    });

    it('returns warm pod when available', async () => {
      const result = await controller.getWarm('project-123');

      expect(result).not.toBeNull();
      expect(result?.state).toBe('allocated');
      expect(result?.allocatedProjectId).toBe('project-123');
    });

    it('updates pod labels on allocation', async () => {
      await controller.getWarm('project-123');

      expect(mockCoreApi.patchNamespacedPod).toHaveBeenCalledWith(
        expect.objectContaining({
          body: {
            metadata: {
              labels: expect.objectContaining({
                'agentpane.io/warm-pool-state': 'allocated',
                'agentpane.io/project-id': 'project-123',
              }),
            },
          },
        })
      );
    });

    it('returns null when no warm pods available', async () => {
      // Exhaust the pool
      await controller.getWarm('project-1');
      await controller.getWarm('project-2');

      const result = await controller.getWarm('project-3');

      expect(result).toBeNull();
    });

    it('tracks allocation metrics', async () => {
      await controller.getWarm('project-123');

      const metrics = controller.getMetrics();
      expect(metrics.totalAllocations).toBe(1);
      expect(metrics.warmPoolHits).toBe(1);
      expect(metrics.warmPoolMisses).toBe(0);
    });

    it('tracks miss metrics when pool empty', async () => {
      await controller.getWarm('project-1');
      await controller.getWarm('project-2');
      await controller.getWarm('project-3'); // Miss

      const metrics = controller.getMetrics();
      expect(metrics.totalAllocations).toBe(3);
      expect(metrics.warmPoolHits).toBe(2);
      expect(metrics.warmPoolMisses).toBe(1);
    });
  });

  describe('release()', () => {
    it('deletes allocated pod on release', async () => {
      await controller.prewarm(1);
      const pod = await controller.getWarm('project-123');
      expect(pod).not.toBeNull();

      await controller.release(pod!.podName);

      expect(mockCoreApi.deleteNamespacedPod).toHaveBeenCalledWith(
        expect.objectContaining({
          name: pod!.podName,
          namespace: 'agentpane-sandboxes',
        })
      );
    });

    it('ignores release for unknown pods', async () => {
      await controller.release('unknown-pod');

      // Should not attempt to delete
      expect(mockCoreApi.deleteNamespacedPod).not.toHaveBeenCalled();
    });
  });

  describe('getMetrics()', () => {
    it('returns initial metrics', () => {
      const metrics = controller.getMetrics();

      expect(metrics.totalPods).toBe(0);
      expect(metrics.warmPods).toBe(0);
      expect(metrics.allocatedPods).toBe(0);
      expect(metrics.utilizationPercent).toBe(0);
      expect(metrics.hitRatePercent).toBe(0);
    });

    it('returns accurate metrics after operations', async () => {
      await controller.prewarm(3);
      await controller.getWarm('project-1');
      await controller.getWarm('project-2');

      const metrics = controller.getMetrics();

      expect(metrics.totalPods).toBe(3);
      expect(metrics.warmPods).toBe(1);
      expect(metrics.allocatedPods).toBe(2);
      expect(metrics.utilizationPercent).toBeCloseTo(66.67, 1);
      expect(metrics.hitRatePercent).toBe(100);
    });

    it('calculates average allocation time', async () => {
      await controller.prewarm(2);
      await controller.getWarm('project-1');

      const metrics = controller.getMetrics();
      expect(metrics.avgWarmAllocationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('isWarmPoolPod()', () => {
    it('returns true for warm pods', async () => {
      await controller.prewarm(1);
      const pods = controller.listPods();
      const firstPod = pods[0];
      expect(firstPod).toBeDefined();
      expect(controller.isWarmPoolPod(firstPod!.podName)).toBe(true);
    });

    it('returns true for allocated pods', async () => {
      await controller.prewarm(1);
      const pod = await controller.getWarm('project-1');

      expect(controller.isWarmPoolPod(pod!.podName)).toBe(true);
    });

    it('returns false for unknown pods', () => {
      expect(controller.isWarmPoolPod('unknown-pod')).toBe(false);
    });
  });

  describe('getPodInfo()', () => {
    it('returns pod info for warm pod', async () => {
      await controller.prewarm(1);
      const pods = controller.listPods();
      const firstPod = pods[0];
      expect(firstPod).toBeDefined();
      const info = controller.getPodInfo(firstPod!.podName);

      expect(info).not.toBeNull();
      expect(info?.state).toBe('warm');
    });

    it('returns pod info for allocated pod', async () => {
      await controller.prewarm(1);
      const pod = await controller.getWarm('project-1');
      const info = controller.getPodInfo(pod!.podName);

      expect(info).not.toBeNull();
      expect(info?.state).toBe('allocated');
      expect(info?.allocatedProjectId).toBe('project-1');
    });

    it('returns null for unknown pod', () => {
      expect(controller.getPodInfo('unknown-pod')).toBeNull();
    });
  });

  describe('listPods()', () => {
    it('lists all pods in pool', async () => {
      await controller.prewarm(3);
      await controller.getWarm('project-1');

      const pods = controller.listPods();

      expect(pods).toHaveLength(3);
      expect(pods.filter((p) => p.state === 'warm')).toHaveLength(2);
      expect(pods.filter((p) => p.state === 'allocated')).toHaveLength(1);
    });

    it('returns empty array when pool is empty', () => {
      const pods = controller.listPods();
      expect(pods).toEqual([]);
    });
  });

  describe('auto-scaling', () => {
    it('calculates target size based on minSize when no usage', () => {
      const metrics = controller.getMetrics();
      expect(metrics.targetSize).toBe(2); // minSize
    });

    it('respects maxSize when scaling up', async () => {
      // Create a controller with small limits
      const smallController = createWarmPoolController(
        mockCoreApi as unknown as k8s.CoreV1Api,
        'agentpane-sandboxes',
        { minSize: 1, maxSize: 3, enableAutoScaling: true }
      );

      await smallController.prewarm(5); // Try to create 5

      const metrics = smallController.getMetrics();
      expect(metrics.totalPods).toBe(3); // Capped at maxSize

      await smallController.stop();
    });
  });

  describe('error handling', () => {
    it('handles pod creation failures gracefully', async () => {
      mockCoreApi.createNamespacedPod.mockRejectedValueOnce(new Error('API error'));

      // Should not throw, just create fewer pods
      const created = await controller.prewarm(2);

      // One failed, one succeeded
      expect(created).toBeLessThanOrEqual(2);
    });

    it('handles pod deletion failures gracefully', async () => {
      await controller.prewarm(1);
      mockCoreApi.deleteNamespacedPod.mockRejectedValueOnce(new Error('API error'));

      // Should not throw
      await expect(controller.stop()).resolves.not.toThrow();
    });

    it('handles allocation patch failures', async () => {
      await controller.prewarm(1);
      mockCoreApi.patchNamespacedPod.mockRejectedValueOnce(new Error('Patch failed'));

      const result = await controller.getWarm('project-1');

      expect(result).toBeNull();
      const metrics = controller.getMetrics();
      expect(metrics.warmPoolMisses).toBe(1);
    });

    it('handles 404 on pod deletion (already deleted)', async () => {
      await controller.prewarm(1);
      const pod = await controller.getWarm('project-1');

      mockCoreApi.deleteNamespacedPod.mockRejectedValueOnce({
        response: { statusCode: 404 },
      });

      // Should not throw
      await expect(controller.release(pod!.podName)).resolves.not.toThrow();
    });
  });

  describe('discovery of existing pods', () => {
    it('discovers and categorizes warm pods', async () => {
      mockCoreApi.listNamespacedPod.mockResolvedValueOnce({
        items: [mockPod('warm-1'), mockPod('warm-2')],
      });

      await controller.start();

      const metrics = controller.getMetrics();
      expect(metrics.warmPods).toBe(2);
    });

    it('discovers and categorizes allocated pods', async () => {
      // Create a controller with minSize=0 to prevent auto-replenishment
      const discoveryController = createWarmPoolController(
        mockCoreApi as unknown as k8s.CoreV1Api,
        'agentpane-sandboxes',
        { minSize: 0, maxSize: 5, replenishIntervalMs: 60000, enableAutoScaling: false }
      );

      mockCoreApi.listNamespacedPod.mockResolvedValueOnce({
        items: [mockPod('warm-1'), mockPod('allocated-1', 'allocated', 'project-1')],
      });

      await discoveryController.start();

      const metrics = discoveryController.getMetrics();
      expect(metrics.warmPods).toBe(1);
      expect(metrics.allocatedPods).toBe(1);

      await discoveryController.stop();
    });
  });
});
