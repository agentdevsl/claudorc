import type * as k8s from '@kubernetes/client-node';
import { createId } from '@paralleldrive/cuid2';
import { K8sErrors } from '../../errors/k8s-errors.js';
import { SANDBOX_DEFAULTS } from '../types.js';
import { getK8sAuditLogger, type K8sAuditLogger } from './k8s-audit.js';
import { K8S_POD_LABELS, K8S_PROVIDER_DEFAULTS } from './k8s-config.js';

/**
 * Warm pool pod labels for identification
 */
export const K8S_WARM_POOL_LABELS = {
  /** Label indicating this is a warm pool pod */
  warmPool: 'agentpane.io/warm-pool',
  /** Label for warm pool pod state: 'warm' | 'allocated' */
  warmPoolState: 'agentpane.io/warm-pool-state',
  /** Label for the pool ID */
  poolId: 'agentpane.io/pool-id',
} as const;

/**
 * Warm pool pod states
 */
export type WarmPoolPodState = 'warm' | 'allocated';

/**
 * Warm pool configuration options
 */
export interface WarmPoolConfig {
  /** Minimum number of warm pods to maintain */
  minSize: number;
  /** Maximum number of warm pods allowed */
  maxSize: number;
  /** Default image for warm pods */
  defaultImage: string;
  /** Default memory in MB for warm pods */
  defaultMemoryMb: number;
  /** Default CPU cores for warm pods */
  defaultCpuCores: number;
  /** Interval (ms) for checking and replenishing the pool */
  replenishIntervalMs: number;
  /** Whether to enable auto-scaling based on usage */
  enableAutoScaling: boolean;
  /** Scale-up threshold (% of pool in use) */
  scaleUpThreshold: number;
  /** Scale-down threshold (% of pool in use) */
  scaleDownThreshold: number;
  /** Time window (ms) for usage pattern analysis */
  usageWindowMs: number;
}

/**
 * Validate warm pool configuration
 * @throws Error if configuration is invalid
 */
export function validateWarmPoolConfig(config: WarmPoolConfig): void {
  if (config.minSize < 0) {
    throw new Error(`Invalid warm pool config: minSize must be >= 0, got ${config.minSize}`);
  }
  if (config.maxSize < 1) {
    throw new Error(`Invalid warm pool config: maxSize must be >= 1, got ${config.maxSize}`);
  }
  if (config.minSize > config.maxSize) {
    throw new Error(
      `Invalid warm pool config: minSize (${config.minSize}) cannot exceed maxSize (${config.maxSize})`
    );
  }
  if (config.scaleUpThreshold <= 0 || config.scaleUpThreshold > 1) {
    throw new Error(
      `Invalid warm pool config: scaleUpThreshold must be between 0 and 1, got ${config.scaleUpThreshold}`
    );
  }
  if (config.scaleDownThreshold < 0 || config.scaleDownThreshold >= 1) {
    throw new Error(
      `Invalid warm pool config: scaleDownThreshold must be between 0 and 1, got ${config.scaleDownThreshold}`
    );
  }
  if (config.scaleDownThreshold >= config.scaleUpThreshold) {
    throw new Error(
      `Invalid warm pool config: scaleDownThreshold (${config.scaleDownThreshold}) must be less than scaleUpThreshold (${config.scaleUpThreshold})`
    );
  }
}

/**
 * Default warm pool configuration
 */
export const WARM_POOL_DEFAULTS: WarmPoolConfig = {
  minSize: 2,
  maxSize: 10,
  defaultImage: SANDBOX_DEFAULTS.image,
  defaultMemoryMb: SANDBOX_DEFAULTS.memoryMb,
  defaultCpuCores: SANDBOX_DEFAULTS.cpuCores,
  replenishIntervalMs: 30_000, // 30 seconds
  enableAutoScaling: true,
  scaleUpThreshold: 0.8, // Scale up when 80% of pool is in use
  scaleDownThreshold: 0.2, // Scale down when only 20% of pool is in use
  usageWindowMs: 5 * 60 * 1000, // 5 minute window
} as const;

/**
 * Warm pool utilization metrics
 */
export interface WarmPoolMetrics {
  /** Total pods in the pool (warm + allocated) */
  totalPods: number;
  /** Number of warm (available) pods */
  warmPods: number;
  /** Number of allocated (in-use) pods */
  allocatedPods: number;
  /** Pool utilization percentage (allocated / total) */
  utilizationPercent: number;
  /** Total allocations since start */
  totalAllocations: number;
  /** Total hits (served from warm pool) */
  warmPoolHits: number;
  /** Total misses (needed cold start) */
  warmPoolMisses: number;
  /** Hit rate percentage */
  hitRatePercent: number;
  /** Average allocation time in ms (from warm pool) */
  avgWarmAllocationMs: number;
  /** Target pool size based on auto-scaling */
  targetSize: number;
  /** Current configuration */
  config: WarmPoolConfig;
}

/**
 * Usage sample for auto-scaling
 */
interface UsageSample {
  timestamp: number;
  warmPods: number;
  allocatedPods: number;
}

/**
 * Base pod info shared by all states
 */
interface WarmPodInfoBase {
  /** Pod name */
  podName: string;
  /** Pod UID */
  podUid: string;
  /** Image used */
  image: string;
  /** When the pod was created */
  createdAt: Date;
  /** When the pod became warm/ready */
  warmAt?: Date;
}

/**
 * Pod in warm (unallocated) state - ready to be assigned to a project
 */
export interface WarmPodInfoWarm extends WarmPodInfoBase {
  state: 'warm';
  /** Warm pods do not have project allocation */
  allocatedProjectId?: never;
  /** Warm pods do not have allocation time */
  allocatedAt?: never;
}

/**
 * Pod in allocated state - assigned to a specific project
 */
export interface WarmPodInfoAllocated extends WarmPodInfoBase {
  state: 'allocated';
  /** Project ID that this pod is allocated to (required for allocated pods) */
  allocatedProjectId: string;
  /** When the pod was allocated (required for allocated pods) */
  allocatedAt: Date;
}

/**
 * Warm pod info - discriminated union that makes illegal states unrepresentable.
 * A warm pod cannot have allocation info, and an allocated pod must have allocation info.
 */
export type WarmPodInfo = WarmPodInfoWarm | WarmPodInfoAllocated;

/**
 * Type guard to check if a pod is in warm state
 */
export function isWarmPod(pod: WarmPodInfo): pod is WarmPodInfoWarm {
  return pod.state === 'warm';
}

/**
 * Type guard to check if a pod is in allocated state
 */
export function isAllocatedPod(pod: WarmPodInfo): pod is WarmPodInfoAllocated {
  return pod.state === 'allocated';
}

/**
 * Warm pool controller for managing pre-warmed K8s pods
 *
 * The warm pool maintains a set of pre-created pods that are ready to be
 * quickly assigned to projects, reducing sandbox boot time from ~30s to <5s.
 *
 * Lifecycle:
 * 1. Prewarm phase: Pods created with generic image, waiting in "warm" state
 * 2. Allocation phase: Warm pod assigned to project, transitions to "allocated"
 * 3. Return phase: When sandbox stops, pod is deleted (not reused for security)
 *
 * Auto-scaling:
 * - Monitors usage patterns over a configurable time window
 * - Scales up when utilization exceeds threshold
 * - Scales down during low usage periods
 * - Respects min/max size constraints
 */
export class WarmPoolController {
  private readonly config: WarmPoolConfig;
  private readonly namespace: string;
  private readonly coreApi: k8s.CoreV1Api;
  private readonly auditLogger: K8sAuditLogger;

  // Pool tracking
  private warmPods = new Map<string, WarmPodInfo>();
  private allocatedPods = new Map<string, WarmPodInfo>();
  private poolId: string;

  // Metrics tracking
  private totalAllocations = 0;
  private warmPoolHits = 0;
  private warmPoolMisses = 0;
  private allocationTimes: number[] = [];

  // Usage samples for auto-scaling
  private usageSamples: UsageSample[] = [];

  // Replenish interval
  private replenishInterval: ReturnType<typeof setInterval> | null = null;
  private isReplenishing = false;

  // Lock for atomic pod allocation to prevent race conditions
  private allocationLock: Promise<void> = Promise.resolve();

  constructor(
    coreApi: k8s.CoreV1Api,
    namespace: string = K8S_PROVIDER_DEFAULTS.namespace,
    config: Partial<WarmPoolConfig> = {}
  ) {
    this.coreApi = coreApi;
    this.namespace = namespace;
    this.config = { ...WARM_POOL_DEFAULTS, ...config };

    // Validate configuration to catch invalid settings early
    validateWarmPoolConfig(this.config);

    this.poolId = createId().slice(0, 8);
    this.auditLogger = getK8sAuditLogger();
  }

  /**
   * Start the warm pool controller
   * Begins periodic replenishment and monitoring
   */
  async start(): Promise<void> {
    // Discover any existing warm pool pods
    await this.discoverExistingPods();

    // Initial prewarm to reach minSize
    await this.replenish();

    // Start periodic replenishment
    if (this.replenishInterval === null) {
      this.replenishInterval = setInterval(() => {
        this.replenish().catch((err) => {
          console.error('[WarmPool] Replenish error:', err);
        });
      }, this.config.replenishIntervalMs);
    }
  }

  /**
   * Stop the warm pool controller
   * Cleans up all warm pods (allocated pods are left for their projects)
   */
  async stop(): Promise<void> {
    // Stop replenishment
    if (this.replenishInterval) {
      clearInterval(this.replenishInterval);
      this.replenishInterval = null;
    }

    // Delete all warm (unallocated) pods
    const deletePromises: Promise<void>[] = [];
    for (const [podName] of this.warmPods) {
      deletePromises.push(
        this.deletePod(podName).catch((err) => {
          console.error(`[WarmPool] Failed to delete warm pod ${podName}:`, err);
        })
      );
    }

    await Promise.all(deletePromises);
    this.warmPods.clear();
  }

  /**
   * Prewarm the pool with a specified number of pods
   * Creates new pods up to the specified count
   *
   * @param count - Number of pods to add to the warm pool
   */
  async prewarm(count: number): Promise<number> {
    const currentTotal = this.warmPods.size + this.allocatedPods.size;
    const maxToCreate = Math.min(count, this.config.maxSize - currentTotal);

    if (maxToCreate <= 0) {
      return 0;
    }

    let created = 0;
    const createPromises: Promise<void>[] = [];

    for (let i = 0; i < maxToCreate; i++) {
      createPromises.push(
        this.createWarmPod().then(() => {
          created++;
        })
      );
    }

    await Promise.allSettled(createPromises);

    this.auditLogger.logWarmPoolPrewarm({
      poolId: this.poolId,
      namespace: this.namespace,
      requested: count,
      created,
      currentPoolSize: this.warmPods.size + this.allocatedPods.size,
    });

    return created;
  }

  /**
   * Get a warm pod for allocation
   * Returns a pre-warmed pod if available, otherwise returns null
   *
   * Uses a lock to prevent race conditions where concurrent callers
   * could receive the same pod before it's removed from the warm pool.
   *
   * @param projectId - Project to allocate the pod to
   * @returns Warm pod info if available, null otherwise
   */
  async getWarm(projectId: string): Promise<WarmPodInfo | null> {
    // Use lock to serialize allocation and prevent concurrent callers getting same pod
    const previousLock = this.allocationLock;
    let releaseLock: () => void;
    this.allocationLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      // Wait for any previous allocation to complete
      await previousLock;

      return await this.allocateWarmPodInternal(projectId);
    } finally {
      // biome-ignore lint/style/noNonNullAssertion: releaseLock is always assigned by the Promise executor which runs synchronously
      releaseLock!();
    }
  }

  /**
   * Internal method to allocate a warm pod (must be called under lock)
   */
  private async allocateWarmPodInternal(projectId: string): Promise<WarmPodInfo | null> {
    const startTime = Date.now();
    this.totalAllocations++;

    // Try to get a warm pod
    const warmPodEntry = this.warmPods.entries().next();
    if (warmPodEntry.done) {
      // No warm pods available
      this.warmPoolMisses++;
      this.recordUsageSample();
      return null;
    }

    const [podName, podInfo] = warmPodEntry.value;

    // Remove from warm pool BEFORE making K8s API call to prevent race condition
    this.warmPods.delete(podName);

    try {
      // Update pod labels to mark as allocated
      await this.coreApi.patchNamespacedPod({
        name: podName,
        namespace: this.namespace,
        body: {
          metadata: {
            labels: {
              [K8S_WARM_POOL_LABELS.warmPoolState]: 'allocated',
              [K8S_POD_LABELS.projectId]: projectId,
            },
          },
        },
      });

      // Move to allocated - create new object without warm-only fields
      const allocatedInfo: WarmPodInfoAllocated = {
        podName: podInfo.podName,
        podUid: podInfo.podUid,
        image: podInfo.image,
        createdAt: podInfo.createdAt,
        warmAt: podInfo.warmAt,
        state: 'allocated',
        allocatedProjectId: projectId,
        allocatedAt: new Date(),
      };
      this.allocatedPods.set(podName, allocatedInfo);

      // Track metrics
      this.warmPoolHits++;
      const allocationTime = Date.now() - startTime;
      this.allocationTimes.push(allocationTime);
      if (this.allocationTimes.length > 100) {
        this.allocationTimes.shift();
      }

      this.recordUsageSample();

      this.auditLogger.logWarmPoolAllocation({
        podName,
        namespace: this.namespace,
        projectId,
        allocationTimeMs: allocationTime,
        remainingWarmPods: this.warmPods.size,
      });

      // Trigger async replenishment (only if auto-scaling is enabled)
      if (this.config.enableAutoScaling) {
        this.replenish().catch((err) => {
          console.error('[WarmPool] Replenish after allocation error:', err);
        });
      }

      return allocatedInfo;
    } catch (error) {
      // Failed to allocate - pod was already removed from warm pool
      // Return it to warm state so it can be retried
      this.warmPods.set(podName, podInfo);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[WarmPool] Failed to allocate pod ${podName}:`, message);
      this.warmPoolMisses++;
      return null;
    }
  }

  /**
   * Release an allocated pod (typically when sandbox stops)
   * For security, we delete the pod rather than returning it to the pool
   *
   * @param podName - Name of the pod to release
   */
  async release(podName: string): Promise<void> {
    const podInfo = this.allocatedPods.get(podName);
    if (!podInfo) {
      return; // Pod not tracked by this pool
    }

    try {
      await this.deletePod(podName);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[WarmPool] Failed to delete released pod ${podName}:`, message);
    }

    this.allocatedPods.delete(podName);
    this.recordUsageSample();
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): WarmPoolMetrics {
    const totalPods = this.warmPods.size + this.allocatedPods.size;
    const warmPods = this.warmPods.size;
    const allocatedPods = this.allocatedPods.size;

    const utilizationPercent = totalPods > 0 ? (allocatedPods / totalPods) * 100 : 0;
    const hitRatePercent =
      this.totalAllocations > 0 ? (this.warmPoolHits / this.totalAllocations) * 100 : 0;

    const avgWarmAllocationMs =
      this.allocationTimes.length > 0
        ? this.allocationTimes.reduce((a, b) => a + b, 0) / this.allocationTimes.length
        : 0;

    return {
      totalPods,
      warmPods,
      allocatedPods,
      utilizationPercent,
      totalAllocations: this.totalAllocations,
      warmPoolHits: this.warmPoolHits,
      warmPoolMisses: this.warmPoolMisses,
      hitRatePercent,
      avgWarmAllocationMs,
      targetSize: this.calculateTargetSize(),
      config: this.config,
    };
  }

  /**
   * Check if a pod is a warm pool pod
   */
  isWarmPoolPod(podName: string): boolean {
    return this.warmPods.has(podName) || this.allocatedPods.has(podName);
  }

  /**
   * Get info for a specific pod
   */
  getPodInfo(podName: string): WarmPodInfo | null {
    return this.warmPods.get(podName) ?? this.allocatedPods.get(podName) ?? null;
  }

  /**
   * List all pods in the pool
   */
  listPods(): WarmPodInfo[] {
    return [...this.warmPods.values(), ...this.allocatedPods.values()];
  }

  /**
   * Replenish the warm pool to reach the target size
   */
  private async replenish(): Promise<void> {
    if (this.isReplenishing) {
      return;
    }

    this.isReplenishing = true;
    try {
      const targetSize = this.calculateTargetSize();
      const currentWarm = this.warmPods.size;

      if (currentWarm < targetSize) {
        // Need to create more warm pods
        const toCreate = targetSize - currentWarm;
        await this.prewarm(toCreate);
      } else if (currentWarm > targetSize && this.config.enableAutoScaling) {
        // Scale down: delete excess warm pods
        const toDelete = currentWarm - targetSize;
        let deleted = 0;
        for (const [podName] of this.warmPods) {
          if (deleted >= toDelete) break;
          try {
            await this.deletePod(podName);
            this.warmPods.delete(podName);
            deleted++;
          } catch (err) {
            console.error(`[WarmPool] Failed to scale down pod ${podName}:`, err);
          }
        }
      }
    } finally {
      this.isReplenishing = false;
    }
  }

  /**
   * Calculate target pool size based on usage patterns
   */
  private calculateTargetSize(): number {
    if (!this.config.enableAutoScaling) {
      return this.config.minSize;
    }

    // Clean old samples
    const cutoff = Date.now() - this.config.usageWindowMs;
    this.usageSamples = this.usageSamples.filter((s) => s.timestamp > cutoff);

    if (this.usageSamples.length === 0) {
      return this.config.minSize;
    }

    // Calculate average utilization over the window
    const avgAllocated =
      this.usageSamples.reduce((sum, s) => sum + s.allocatedPods, 0) / this.usageSamples.length;
    const avgTotal =
      this.usageSamples.reduce((sum, s) => sum + s.warmPods + s.allocatedPods, 0) /
      this.usageSamples.length;

    if (avgTotal === 0) {
      return this.config.minSize;
    }

    const avgUtilization = avgAllocated / avgTotal;

    let targetSize = this.config.minSize;

    if (avgUtilization > this.config.scaleUpThreshold) {
      // High utilization: scale up
      // Target: enough pods so utilization would be ~60%
      targetSize = Math.ceil(avgAllocated / 0.6);
    } else if (avgUtilization < this.config.scaleDownThreshold) {
      // Low utilization: scale down
      targetSize = Math.max(this.config.minSize, Math.ceil(avgAllocated * 1.5));
    } else {
      // Moderate utilization: maintain current
      targetSize = Math.ceil(avgTotal);
    }

    // Clamp to min/max
    return Math.max(this.config.minSize, Math.min(this.config.maxSize, targetSize));
  }

  /**
   * Record a usage sample for auto-scaling
   */
  private recordUsageSample(): void {
    this.usageSamples.push({
      timestamp: Date.now(),
      warmPods: this.warmPods.size,
      allocatedPods: this.allocatedPods.size,
    });

    // Keep only samples within the window
    const cutoff = Date.now() - this.config.usageWindowMs;
    this.usageSamples = this.usageSamples.filter((s) => s.timestamp > cutoff);
  }

  /**
   * Discover existing warm pool pods in the namespace
   * @throws K8sErrors if discovery fails (prevents orphaned pods from being untracked)
   */
  private async discoverExistingPods(): Promise<void> {
    try {
      const pods = await this.coreApi.listNamespacedPod({
        namespace: this.namespace,
        labelSelector: `${K8S_WARM_POOL_LABELS.warmPool}=true`,
      });

      for (const pod of pods.items) {
        const podName = pod.metadata?.name;
        const podUid = pod.metadata?.uid;
        const state = pod.metadata?.labels?.[
          K8S_WARM_POOL_LABELS.warmPoolState
        ] as WarmPoolPodState;
        const projectId = pod.metadata?.labels?.[K8S_POD_LABELS.projectId];

        if (!podName || !podUid) continue;

        const image = pod.spec?.containers[0]?.image ?? this.config.defaultImage;
        const createdAt = pod.metadata?.creationTimestamp
          ? new Date(pod.metadata.creationTimestamp)
          : new Date();

        // Use discriminated union based on state and projectId
        if (state === 'allocated' && projectId) {
          const allocatedPod: WarmPodInfoAllocated = {
            podName,
            podUid,
            state: 'allocated',
            image,
            createdAt,
            warmAt: createdAt,
            allocatedProjectId: projectId,
            allocatedAt: new Date(), // Best approximation for discovery
          };
          this.allocatedPods.set(podName, allocatedPod);
        } else {
          const warmPod: WarmPodInfoWarm = {
            podName,
            podUid,
            state: 'warm',
            image,
            createdAt,
            warmAt: createdAt,
          };
          this.warmPods.set(podName, warmPod);
        }
      }

      this.auditLogger.logWarmPoolDiscovery({
        poolId: this.poolId,
        namespace: this.namespace,
        warmPodsDiscovered: this.warmPods.size,
        allocatedPodsDiscovered: this.allocatedPods.size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Re-throw to prevent silent orphaning of pods
      // If discovery fails, caller should handle the error appropriately
      console.error('[WarmPool] Failed to discover existing pods:', message);
      throw K8sErrors.WARM_POOL_DISCOVERY_FAILED(message);
    }
  }

  /**
   * Create a new warm pod
   */
  private async createWarmPod(): Promise<WarmPodInfo> {
    const podId = createId().slice(0, 8);
    const podName = `agentpane-warm-${this.poolId}-${podId}`.toLowerCase();

    const podSpec = this.buildWarmPodSpec(podName);

    try {
      const response = await this.coreApi.createNamespacedPod({
        namespace: this.namespace,
        body: podSpec,
      });

      const podUid = response.metadata?.uid ?? podName;

      // Wait for pod to be running
      await this.waitForPodRunning(podName);

      const podInfo: WarmPodInfoWarm = {
        podName,
        podUid,
        state: 'warm',
        image: this.config.defaultImage,
        createdAt: new Date(),
        warmAt: new Date(),
      };

      this.warmPods.set(podName, podInfo);

      this.auditLogger.logWarmPoolPodCreated({
        podName,
        namespace: this.namespace,
      });

      return podInfo;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.POD_CREATION_FAILED(podName, message);
    }
  }

  /**
   * Build pod spec for a warm pool pod
   */
  private buildWarmPodSpec(podName: string): k8s.V1Pod {
    return {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace: this.namespace,
        labels: {
          [K8S_POD_LABELS.sandbox]: 'true',
          [K8S_WARM_POOL_LABELS.warmPool]: 'true',
          [K8S_WARM_POOL_LABELS.warmPoolState]: 'warm',
          [K8S_WARM_POOL_LABELS.poolId]: this.poolId,
        },
      },
      spec: {
        restartPolicy: 'Never',
        securityContext: {
          runAsNonRoot: true,
          runAsUser: 1000,
          fsGroup: 1000,
          seccompProfile: {
            type: 'RuntimeDefault',
          },
        },
        containers: [
          {
            name: 'sandbox',
            image: this.config.defaultImage,
            workingDir: '/workspace',
            command: ['tail', '-f', '/dev/null'],
            resources: {
              limits: {
                memory: `${this.config.defaultMemoryMb}Mi`,
                cpu: `${this.config.defaultCpuCores}`,
              },
              requests: {
                memory: `${Math.floor(this.config.defaultMemoryMb / 2)}Mi`,
                cpu: `${this.config.defaultCpuCores / 2}`,
              },
            },
            securityContext: {
              allowPrivilegeEscalation: false,
              capabilities: {
                drop: ['ALL'],
              },
            },
            // Warm pods don't have a workspace volume mounted.
            // IMPORTANT: K8s doesn't support adding volumes to running pods.
            // When allocated, workspace content must be synced via exec commands
            // or use pre-configured shared storage (NFS, CSI, etc.)
          },
        ],
      },
    };
  }

  /**
   * Wait for a pod to be running
   */
  private async waitForPodRunning(podName: string, timeoutSeconds = 120): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = timeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const response = await this.coreApi.readNamespacedPod({
          name: podName,
          namespace: this.namespace,
        });

        const phase = response.status?.phase;
        const containerStatuses = response.status?.containerStatuses;

        if (phase === 'Running') {
          const allReady = containerStatuses?.every((cs) => cs.ready) ?? false;
          if (allReady) {
            return;
          }
        }

        if (phase === 'Failed' || phase === 'Succeeded') {
          throw K8sErrors.POD_NOT_RUNNING(podName, phase);
        }

        // Check for ImagePullBackOff
        const waitingReason = containerStatuses?.[0]?.state?.waiting?.reason;
        if (waitingReason === 'ImagePullBackOff' || waitingReason === 'ErrImagePull') {
          const message = containerStatuses?.[0]?.state?.waiting?.message ?? 'Unknown error';
          throw K8sErrors.IMAGE_PULL_BACKOFF(this.config.defaultImage, message);
        }
      } catch (error) {
        // Check if pod was deleted
        if (error && typeof error === 'object' && 'response' in error) {
          const httpError = error as { response?: { statusCode?: number } };
          if (httpError.response?.statusCode === 404) {
            throw K8sErrors.POD_NOT_FOUND(podName, this.namespace);
          }
        }
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw K8sErrors.POD_STARTUP_TIMEOUT(podName, timeoutSeconds);
  }

  /**
   * Delete a pod
   */
  private async deletePod(podName: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespacedPod({
        name: podName,
        namespace: this.namespace,
        gracePeriodSeconds: 10,
      });

      this.auditLogger.logWarmPoolPodDeleted({
        podName,
        namespace: this.namespace,
      });
    } catch (error) {
      // Ignore 404 (already deleted)
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode === 404) {
          return;
        }
      }
      throw error;
    }
  }
}

/**
 * Create a warm pool controller
 */
export function createWarmPoolController(
  coreApi: k8s.CoreV1Api,
  namespace?: string,
  config?: Partial<WarmPoolConfig>
): WarmPoolController {
  return new WarmPoolController(coreApi, namespace, config);
}
