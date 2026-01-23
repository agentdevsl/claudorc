import * as k8s from '@kubernetes/client-node';
import { createId } from '@paralleldrive/cuid2';
import { K8sErrors } from '../../errors/k8s-errors.js';
import type { SandboxConfig, SandboxHealthCheck, SandboxInfo } from '../types.js';
import { SANDBOX_DEFAULTS } from '../types.js';
import { getK8sAuditLogger, type K8sAuditLogger } from './k8s-audit.js';
import {
  getClusterInfo,
  K8S_POD_LABELS,
  K8S_PROVIDER_DEFAULTS,
  type K8sProviderOptions,
  loadKubeConfig,
  resolveContext,
} from './k8s-config.js';
import {
  createNetworkPolicyManager,
  type K8sNetworkPolicyManager,
  NETWORK_POLICY_DEFAULTS,
} from './k8s-network-policy.js';
import { createRbacManager, type K8sRbacManager } from './k8s-rbac.js';
import { K8sSandbox } from './k8s-sandbox.js';
import { getPodSecurityValidator } from './k8s-security.js';
import {
  createWarmPoolController,
  type WarmPoolConfig,
  type WarmPoolController,
  type WarmPoolMetrics,
} from './k8s-warm-pool.js';
import type {
  EventEmittingSandboxProvider,
  Sandbox,
  SandboxProviderEvent,
  SandboxProviderEventListener,
} from './sandbox-provider.js';

/**
 * Kubernetes-based sandbox provider
 * Uses pods in a dedicated namespace to run isolated workloads
 */
export class K8sProvider implements EventEmittingSandboxProvider {
  readonly name = 'kubernetes';

  private kc: k8s.KubeConfig;
  private coreApi: k8s.CoreV1Api;
  private networkingApi: k8s.NetworkingV1Api;
  private rbacApi: k8s.RbacAuthorizationV1Api;
  private readonly namespace: string;
  private readonly createNamespace: boolean;
  private readonly podStartupTimeoutSeconds: number;

  // Security managers
  private networkPolicyManager: K8sNetworkPolicyManager;
  private rbacManager: K8sRbacManager;
  private auditLogger: K8sAuditLogger;

  // Security configuration
  private readonly networkPolicyEnabled: boolean;
  private readonly allowedEgressHosts: string[];
  private readonly setupRbac: boolean;

  // Warm pool configuration
  private readonly warmPoolEnabled: boolean;
  private warmPoolController: WarmPoolController | null = null;

  private sandboxes = new Map<string, K8sSandbox>();
  private projectToSandbox = new Map<string, string>();
  private listeners = new Set<SandboxProviderEventListener>();

  // Track if security resources have been initialized
  private securityInitialized = false;

  constructor(options: K8sProviderOptions = {}) {
    // Load kubeconfig
    this.kc = loadKubeConfig(options.kubeconfigPath);

    // Resolve context if specified
    if (options.context) {
      resolveContext(this.kc, options.context);
    }

    // Create API clients
    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.networkingApi = this.kc.makeApiClient(k8s.NetworkingV1Api);
    this.rbacApi = this.kc.makeApiClient(k8s.RbacAuthorizationV1Api);

    // Configuration
    this.namespace = options.namespace ?? K8S_PROVIDER_DEFAULTS.namespace;
    this.createNamespace = options.createNamespace ?? K8S_PROVIDER_DEFAULTS.createNamespace;
    this.podStartupTimeoutSeconds =
      options.podStartupTimeoutSeconds ?? K8S_PROVIDER_DEFAULTS.podStartupTimeoutSeconds;

    // Security configuration
    this.networkPolicyEnabled =
      options.networkPolicyEnabled ?? K8S_PROVIDER_DEFAULTS.networkPolicyEnabled;
    this.allowedEgressHosts = options.allowedEgressHosts ?? [];
    this.setupRbac = options.setupRbac ?? K8S_PROVIDER_DEFAULTS.setupRbac;

    // Initialize security managers
    this.networkPolicyManager = createNetworkPolicyManager(this.networkingApi, this.namespace);
    this.rbacManager = createRbacManager(this.coreApi, this.rbacApi, this.namespace);

    // Initialize audit logger
    this.auditLogger = getK8sAuditLogger();
    this.auditLogger.setEnabled(
      options.enableAuditLogging ?? K8S_PROVIDER_DEFAULTS.enableAuditLogging
    );

    // Warm pool configuration
    this.warmPoolEnabled = options.enableWarmPool ?? K8S_PROVIDER_DEFAULTS.enableWarmPool;
    if (this.warmPoolEnabled) {
      const warmPoolConfig: Partial<WarmPoolConfig> = {
        minSize: options.warmPoolMinSize ?? K8S_PROVIDER_DEFAULTS.warmPoolMinSize,
        maxSize: options.warmPoolMaxSize ?? K8S_PROVIDER_DEFAULTS.warmPoolMaxSize,
        enableAutoScaling: options.warmPoolAutoScaling ?? K8S_PROVIDER_DEFAULTS.warmPoolAutoScaling,
      };
      this.warmPoolController = createWarmPoolController(
        this.coreApi,
        this.namespace,
        warmPoolConfig
      );
    }
  }

  async create(config: SandboxConfig): Promise<Sandbox> {
    const startTime = Date.now();

    // Check if sandbox already exists for project
    const existing = this.projectToSandbox.get(config.projectId);
    if (existing) {
      const sandbox = this.sandboxes.get(existing);
      if (sandbox && sandbox.status !== 'stopped') {
        throw K8sErrors.POD_ALREADY_EXISTS(config.projectId);
      }
    }

    const sandboxId = createId();
    const podName = `agentpane-${config.projectId.slice(0, 20)}-${sandboxId.slice(0, 8)}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-');

    this.emit({
      type: 'sandbox:creating',
      sandboxId,
      projectId: config.projectId,
    });

    try {
      // Ensure namespace and security resources exist
      await this.ensureNamespace();
      await this.ensureSecurityResources();

      // Build pod spec
      const podSpec = this.buildPodSpec(podName, sandboxId, config);

      // Validate pod security
      const validator = getPodSecurityValidator();
      const validationResult = validator.validateRestricted(podSpec);
      if (!validationResult.valid) {
        this.auditLogger.logPssValidation({
          podName,
          namespace: this.namespace,
          passed: false,
          profile: 'restricted',
          violations: validationResult.violations,
        });
        throw K8sErrors.POD_SECURITY_VIOLATION(podName, validationResult.violations.join('; '));
      }
      this.auditLogger.logPssValidation({
        podName,
        namespace: this.namespace,
        passed: true,
        profile: 'restricted',
      });

      // Create pod
      const response = await this.coreApi.createNamespacedPod({
        namespace: this.namespace,
        body: podSpec,
      });

      const podUid = response.metadata?.uid ?? podName;

      // Wait for pod to be running
      await this.waitForPodRunning(podName);

      const durationMs = Date.now() - startTime;

      // Log pod creation
      this.auditLogger.logPodCreated({
        podName,
        namespace: this.namespace,
        sandboxId,
        projectId: config.projectId,
        image: config.image,
        durationMs,
      });

      // Create per-sandbox network policy if enabled
      if (this.networkPolicyEnabled) {
        await this.networkPolicyManager.createSandboxPolicy(sandboxId, config.projectId, {
          ...NETWORK_POLICY_DEFAULTS,
          enabled: true,
          allowedEgressHosts: this.allowedEgressHosts,
        });
      }

      const sandbox = new K8sSandbox(
        sandboxId,
        config.projectId,
        podUid,
        podName,
        this.namespace,
        this.coreApi,
        this.kc,
        'running'
      );

      this.sandboxes.set(sandboxId, sandbox);
      this.projectToSandbox.set(config.projectId, sandboxId);

      this.emit({
        type: 'sandbox:created',
        sandboxId,
        projectId: config.projectId,
        containerId: podUid,
      });

      this.emit({ type: 'sandbox:started', sandboxId });

      this.auditLogger.logPodStarted({
        podName,
        namespace: this.namespace,
        sandboxId,
      });

      return sandbox;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      this.auditLogger.logPodFailed({
        podName,
        namespace: this.namespace,
        sandboxId,
        error: message,
      });

      this.emit({
        type: 'sandbox:error',
        sandboxId,
        error: error instanceof Error ? error : new Error(message),
      });

      // Re-throw K8s errors directly (they're already properly formatted)
      if (error && typeof error === 'object' && 'code' in error) {
        const appError = error as { code: string };
        if (appError.code.startsWith('K8S_')) {
          throw error;
        }
      }

      // Check for specific K8s API errors
      if (error && typeof error === 'object' && 'body' in error) {
        const k8sError = error as { body?: { message?: string; reason?: string } };
        if (k8sError.body?.reason === 'AlreadyExists') {
          throw K8sErrors.POD_ALREADY_EXISTS(config.projectId);
        }
      }

      throw K8sErrors.POD_CREATION_FAILED(podName, message);
    }
  }

  async get(projectId: string): Promise<Sandbox | null> {
    const sandboxId = this.projectToSandbox.get(projectId);
    if (!sandboxId) {
      return null;
    }
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async getById(sandboxId: string): Promise<Sandbox | null> {
    return this.sandboxes.get(sandboxId) ?? null;
  }

  async list(): Promise<SandboxInfo[]> {
    const infos: SandboxInfo[] = [];

    for (const [sandboxId, sandbox] of this.sandboxes) {
      infos.push({
        id: sandboxId,
        projectId: sandbox.projectId,
        containerId: sandbox.containerId,
        status: sandbox.status,
        image: 'unknown', // Would need to store this or query the pod
        createdAt: new Date().toISOString(),
        lastActivityAt: sandbox.getLastActivity().toISOString(),
        memoryMb: SANDBOX_DEFAULTS.memoryMb,
        cpuCores: SANDBOX_DEFAULTS.cpuCores,
      });
    }

    return infos;
  }

  async pullImage(image: string): Promise<void> {
    // K8s doesn't have a direct image pull API like Docker
    // Images are pulled when pods are scheduled
    // We can create a dummy pod to trigger the pull, but that's complex

    // For now, we just verify the image format is valid
    if (!image || image.trim() === '') {
      throw K8sErrors.IMAGE_NOT_FOUND(image);
    }

    // In a real implementation, you might:
    // 1. Create a Job that pulls the image and exits
    // 2. Use containerd/CRI directly if you have access
    // 3. Pre-pull images via DaemonSet

    // For local development with minikube/kind, images are usually
    // already available or pulled on first pod creation
  }

  async isImageAvailable(image: string): Promise<boolean> {
    // K8s doesn't have a direct way to check if an image is available
    // on all nodes without trying to schedule a pod

    // Return true to indicate we'll try to pull on demand
    // The create() method will handle ImagePullBackOff errors
    return image !== undefined && image.trim() !== '';
  }

  async healthCheck(): Promise<SandboxHealthCheck> {
    try {
      // Check cluster connectivity by listing namespaces
      await this.coreApi.listNamespace({ limit: 1 });

      // Get cluster info
      const clusterInfo = getClusterInfo(this.kc);
      const currentContext = this.kc.getCurrentContext();

      // Check if our namespace exists
      let namespaceExists = false;
      try {
        await this.coreApi.readNamespace({ name: this.namespace });
        namespaceExists = true;
      } catch {
        namespaceExists = false;
      }

      // Get version info
      const versionApi = this.kc.makeApiClient(k8s.VersionApi);
      let serverVersion = 'unknown';
      try {
        const versionInfo = await versionApi.getCode();
        serverVersion = versionInfo.gitVersion ?? 'unknown';
      } catch {
        // Version API might not be available
      }

      // Count sandbox pods
      let podCount = 0;
      let runningPodCount = 0;
      if (namespaceExists) {
        try {
          const pods = await this.coreApi.listNamespacedPod({
            namespace: this.namespace,
            labelSelector: `${K8S_POD_LABELS.sandbox}=true`,
          });
          podCount = pods.items.length;
          runningPodCount = pods.items.filter((p) => p.status?.phase === 'Running').length;
        } catch {
          // Ignore errors counting pods
        }
      }

      // Get warm pool metrics if enabled
      const warmPoolMetrics = this.warmPoolController?.getMetrics();

      return {
        healthy: true,
        details: {
          provider: 'kubernetes',
          context: currentContext,
          cluster: clusterInfo?.name,
          server: clusterInfo?.server,
          serverVersion,
          namespace: this.namespace,
          namespaceExists,
          pods: podCount,
          podsRunning: runningPodCount,
          warmPool: warmPoolMetrics
            ? {
                enabled: true,
                warmPods: warmPoolMetrics.warmPods,
                allocatedPods: warmPoolMetrics.allocatedPods,
                hitRatePercent: warmPoolMetrics.hitRatePercent,
                avgWarmAllocationMs: warmPoolMetrics.avgWarmAllocationMs,
              }
            : { enabled: false },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        message: `Kubernetes health check failed: ${message}`,
        details: {
          provider: 'kubernetes',
          namespace: this.namespace,
        },
      };
    }
  }

  async cleanup(options?: { olderThan?: Date; status?: string[] }): Promise<number> {
    let cleaned = 0;

    for (const [sandboxId, sandbox] of this.sandboxes) {
      const shouldClean =
        (options?.status?.includes(sandbox.status) ?? sandbox.status === 'stopped') &&
        (!options?.olderThan || sandbox.getLastActivity() < options.olderThan);

      if (shouldClean) {
        try {
          if (sandbox.status !== 'stopped') {
            await sandbox.stop();
          }

          // Delete sandbox-specific network policy
          if (this.networkPolicyEnabled) {
            try {
              await this.networkPolicyManager.deleteSandboxPolicy(sandboxId);
              this.auditLogger.logNetworkPolicyDeleted({
                policyName: `sandbox-${sandboxId}-policy`,
                namespace: this.namespace,
                sandboxId,
              });
            } catch {
              // Ignore errors deleting network policy
            }
          }

          this.auditLogger.logPodDeleted({
            podName: sandbox.podName,
            namespace: this.namespace,
            sandboxId,
          });

          this.sandboxes.delete(sandboxId);
          this.projectToSandbox.delete(sandbox.projectId);
          cleaned++;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`[K8sProvider] Failed to cleanup sandbox ${sandboxId}:`, message);
        }
      }
    }

    return cleaned;
  }

  /**
   * Initialize and start the warm pool
   * Must be called before using prewarm() or getWarm()
   */
  async startWarmPool(): Promise<void> {
    if (!this.warmPoolController) {
      throw K8sErrors.WARM_POOL_NOT_ENABLED();
    }

    // Ensure namespace and security resources exist
    await this.ensureNamespace();
    await this.ensureSecurityResources();

    await this.warmPoolController.start();
  }

  /**
   * Stop the warm pool and clean up warm pods
   */
  async stopWarmPool(): Promise<void> {
    if (this.warmPoolController) {
      await this.warmPoolController.stop();
    }
  }

  /**
   * Prewarm the pool with a specified number of pods
   * Creates new pods up to the specified count (respects maxSize)
   *
   * @param count - Number of pods to add to the warm pool
   * @returns Number of pods actually created
   */
  async prewarm(count: number): Promise<number> {
    if (!this.warmPoolController) {
      throw K8sErrors.WARM_POOL_NOT_ENABLED();
    }

    // Ensure namespace and security resources exist
    await this.ensureNamespace();
    await this.ensureSecurityResources();

    return this.warmPoolController.prewarm(count);
  }

  /**
   * Get a warm pod for fast allocation
   * Returns a pre-warmed sandbox if available, otherwise creates a new one
   *
   * @param config - Sandbox configuration
   * @returns A sandbox (either from warm pool or newly created)
   */
  async getWarm(config: SandboxConfig): Promise<Sandbox> {
    if (!this.warmPoolController) {
      // Warm pool not enabled, fall back to normal creation
      return this.create(config);
    }

    const startTime = Date.now();

    // Try to get a warm pod
    const warmPod = await this.warmPoolController.getWarm(config.projectId);

    if (warmPod) {
      // Got a warm pod, create sandbox from it
      const sandboxId = createId();

      this.emit({
        type: 'sandbox:creating',
        sandboxId,
        projectId: config.projectId,
      });

      try {
        // Configure the warm pod with project-specific volume mount
        await this.configureWarmPodForProject(warmPod.podName, config);

        // Create per-sandbox network policy if enabled
        if (this.networkPolicyEnabled) {
          await this.networkPolicyManager.createSandboxPolicy(sandboxId, config.projectId, {
            ...NETWORK_POLICY_DEFAULTS,
            enabled: true,
            allowedEgressHosts: this.allowedEgressHosts,
          });
        }

        const sandbox = new K8sSandbox(
          sandboxId,
          config.projectId,
          warmPod.podUid,
          warmPod.podName,
          this.namespace,
          this.coreApi,
          this.kc,
          'running'
        );

        this.sandboxes.set(sandboxId, sandbox);
        this.projectToSandbox.set(config.projectId, sandboxId);

        const durationMs = Date.now() - startTime;

        this.auditLogger.logPodCreated({
          podName: warmPod.podName,
          namespace: this.namespace,
          sandboxId,
          projectId: config.projectId,
          image: config.image,
          durationMs,
        });

        this.emit({
          type: 'sandbox:created',
          sandboxId,
          projectId: config.projectId,
          containerId: warmPod.podUid,
        });

        this.emit({ type: 'sandbox:started', sandboxId });

        return sandbox;
      } catch (error) {
        // Failed to configure warm pod, release it and fall back
        await this.warmPoolController.release(warmPod.podName);
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[K8sProvider] Failed to configure warm pod, falling back: ${message}`);
      }
    }

    // No warm pod available or configuration failed, create a new one
    return this.create(config);
  }

  /**
   * Get warm pool metrics
   * Returns null if warm pool is not enabled
   */
  getWarmPoolMetrics(): WarmPoolMetrics | null {
    if (!this.warmPoolController) {
      return null;
    }
    return this.warmPoolController.getMetrics();
  }

  /**
   * Check if warm pool is enabled
   */
  isWarmPoolEnabled(): boolean {
    return this.warmPoolEnabled;
  }

  /**
   * Configure a warm pod with project-specific settings
   */
  private async configureWarmPodForProject(podName: string, config: SandboxConfig): Promise<void> {
    // Note: K8s doesn't support adding volume mounts to running pods
    // The warm pod approach works best when the workspace is mounted at pod creation
    // or when using a shared volume solution (NFS, PVC, etc.)
    //
    // For the initial implementation, we rely on the warm pods being generic
    // and the actual workspace content being synced via exec commands or
    // a shared storage solution configured at the cluster level.
    //
    // A more complete implementation would:
    // 1. Use a DaemonSet with hostPath volumes pre-mounted
    // 2. Use a CSI driver that supports dynamic mounting
    // 3. Use git clone/rsync to sync workspace content

    // Update pod labels to include sandbox and project info
    await this.coreApi.patchNamespacedPod({
      name: podName,
      namespace: this.namespace,
      body: {
        metadata: {
          labels: {
            [K8S_POD_LABELS.projectId]: config.projectId,
          },
        },
      },
    });

    // Set environment variables if any
    if (config.env && Object.keys(config.env).length > 0) {
      // Environment variables can't be updated in running pods
      // Log a warning if env vars were requested
      console.warn(
        `[K8sProvider] Cannot update environment variables on warm pod ${podName}. ` +
          `Consider pre-configuring env vars in the base image or using exec to set them.`
      );
    }
  }

  on(listener: SandboxProviderEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  off(listener: SandboxProviderEventListener): void {
    this.listeners.delete(listener);
  }

  private emit(event: SandboxProviderEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[K8sProvider] Event listener error:', error);
      }
    }
  }

  /**
   * Ensure security resources (RBAC, NetworkPolicy) are initialized
   */
  private async ensureSecurityResources(): Promise<void> {
    if (this.securityInitialized) {
      return;
    }

    // Setup RBAC if enabled
    if (this.setupRbac) {
      try {
        await this.rbacManager.ensureRbac();
        this.auditLogger.logRbacCreated({
          resourceType: 'service_account',
          resourceName: 'agentpane-sandbox-controller',
          namespace: this.namespace,
        });
      } catch (error) {
        // Log but don't fail - RBAC may already exist or user may have custom setup
        console.warn('[K8sProvider] RBAC setup warning:', error);
      }
    }

    // Setup default network policy if enabled
    if (this.networkPolicyEnabled) {
      try {
        await this.networkPolicyManager.ensureDefaultPolicy({
          ...NETWORK_POLICY_DEFAULTS,
          enabled: true,
          allowedEgressHosts: this.allowedEgressHosts,
        });
        this.auditLogger.logNetworkPolicyCreated({
          policyName: 'sandbox-default-policy',
          namespace: this.namespace,
        });
      } catch (error) {
        // Log but don't fail - network policies may already exist
        console.warn('[K8sProvider] NetworkPolicy setup warning:', error);
      }
    }

    this.securityInitialized = true;
  }

  private async ensureNamespace(): Promise<void> {
    try {
      await this.coreApi.readNamespace({ name: this.namespace });
      return; // Namespace exists
    } catch (error) {
      // Check if it's a 404 (not found)
      if (error && typeof error === 'object' && 'response' in error) {
        const httpError = error as { response?: { statusCode?: number } };
        if (httpError.response?.statusCode !== 404) {
          const message = error instanceof Error ? error.message : String(error);
          throw K8sErrors.NAMESPACE_CREATION_FAILED(this.namespace, message);
        }
      }
    }

    if (!this.createNamespace) {
      throw K8sErrors.NAMESPACE_NOT_FOUND(this.namespace);
    }

    // Create namespace with Pod Security Standards labels
    const namespaceLabels = {
      'agentpane.io/managed': 'true',
      // Pod Security Standards enforcement
      'pod-security.kubernetes.io/enforce': 'restricted',
      'pod-security.kubernetes.io/enforce-version': 'latest',
      'pod-security.kubernetes.io/warn': 'restricted',
      'pod-security.kubernetes.io/warn-version': 'latest',
      'pod-security.kubernetes.io/audit': 'restricted',
      'pod-security.kubernetes.io/audit-version': 'latest',
    };

    try {
      await this.coreApi.createNamespace({
        body: {
          metadata: {
            name: this.namespace,
            labels: namespaceLabels,
          },
        },
      });

      this.auditLogger.logNamespaceCreated({
        namespace: this.namespace,
        labels: namespaceLabels,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw K8sErrors.NAMESPACE_CREATION_FAILED(this.namespace, message);
    }
  }

  private buildPodSpec(podName: string, sandboxId: string, config: SandboxConfig): k8s.V1Pod {
    // Build volume mounts
    const volumeMounts: k8s.V1VolumeMount[] = [
      {
        name: 'workspace',
        mountPath: '/workspace',
      },
      ...config.volumeMounts.map((v, i) => ({
        name: `volume-${i}`,
        mountPath: v.containerPath,
        readOnly: v.readonly ?? false,
      })),
    ];

    // Build volumes
    const volumes: k8s.V1Volume[] = [
      {
        name: 'workspace',
        hostPath: {
          path: config.projectPath,
          type: 'Directory',
        },
      },
      ...config.volumeMounts.map((v, i) => ({
        name: `volume-${i}`,
        hostPath: {
          path: v.hostPath,
          type: 'Directory',
        },
      })),
    ];

    // Build environment variables
    const env: k8s.V1EnvVar[] = Object.entries(config.env ?? {}).map(([name, value]) => ({
      name,
      value,
    }));

    return {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace: this.namespace,
        labels: {
          [K8S_POD_LABELS.sandbox]: 'true',
          [K8S_POD_LABELS.sandboxId]: sandboxId,
          [K8S_POD_LABELS.projectId]: config.projectId,
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
            image: config.image,
            workingDir: '/workspace',
            command: ['tail', '-f', '/dev/null'],
            resources: {
              limits: {
                memory: `${config.memoryMb}Mi`,
                cpu: `${config.cpuCores}`,
              },
              requests: {
                memory: `${Math.floor(config.memoryMb / 2)}Mi`,
                cpu: `${config.cpuCores / 2}`,
              },
            },
            securityContext: {
              allowPrivilegeEscalation: false,
              capabilities: {
                drop: ['ALL'],
              },
            },
            volumeMounts,
            env: env.length > 0 ? env : undefined,
          },
        ],
        volumes,
      },
    };
  }

  private async waitForPodRunning(podName: string): Promise<void> {
    const startTime = Date.now();
    const timeoutMs = this.podStartupTimeoutSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      const response = await this.coreApi.readNamespacedPod({
        name: podName,
        namespace: this.namespace,
      });

      const phase = response.status?.phase;
      const containerStatuses = response.status?.containerStatuses;

      // Check for running
      if (phase === 'Running') {
        const allReady = containerStatuses?.every((cs) => cs.ready) ?? false;
        if (allReady) {
          return;
        }
      }

      // Check for failure conditions
      if (phase === 'Failed' || phase === 'Succeeded') {
        throw K8sErrors.POD_NOT_RUNNING(podName, phase);
      }

      // Check for ImagePullBackOff
      const waitingReason = containerStatuses?.[0]?.state?.waiting?.reason;
      if (waitingReason === 'ImagePullBackOff' || waitingReason === 'ErrImagePull') {
        const message = containerStatuses?.[0]?.state?.waiting?.message ?? 'Unknown error';
        throw K8sErrors.IMAGE_PULL_BACKOFF(
          response.spec?.containers[0]?.image ?? 'unknown',
          message
        );
      }

      // Wait before checking again
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw K8sErrors.POD_STARTUP_TIMEOUT(podName, this.podStartupTimeoutSeconds);
  }
}

/**
 * Create a Kubernetes provider
 */
export function createK8sProvider(options?: K8sProviderOptions): K8sProvider {
  return new K8sProvider(options);
}
