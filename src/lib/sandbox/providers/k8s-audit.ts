/**
 * K8s Security Audit Logger
 *
 * Provides structured logging for Kubernetes security-related operations.
 * Logs are written to stdout in JSON format for easy parsing by log aggregators.
 */

/**
 * Audit event types for K8s operations
 */
export type K8sAuditEventType =
  // Pod lifecycle events
  | 'pod.created'
  | 'pod.started'
  | 'pod.stopped'
  | 'pod.deleted'
  | 'pod.failed'
  // Network policy events
  | 'network_policy.created'
  | 'network_policy.updated'
  | 'network_policy.deleted'
  // RBAC events
  | 'rbac.service_account_created'
  | 'rbac.role_created'
  | 'rbac.role_binding_created'
  | 'rbac.cluster_role_created'
  | 'rbac.cluster_role_binding_created'
  // Configuration events
  | 'config.network_policy_enabled'
  | 'config.network_policy_disabled'
  | 'config.egress_hosts_updated'
  // Security events
  | 'security.exec_command'
  | 'security.exec_as_root_attempted'
  | 'security.pss_validation_passed'
  | 'security.pss_validation_failed'
  // Namespace events
  | 'namespace.created'
  | 'namespace.deleted'
  // Warm pool events
  | 'warm_pool.prewarm'
  | 'warm_pool.allocation'
  | 'warm_pool.pod_created'
  | 'warm_pool.pod_deleted'
  | 'warm_pool.discovery'
  // PVC events
  | 'pvc.created'
  | 'pvc.deleted';

/**
 * Severity levels for audit events
 */
export type K8sAuditSeverity = 'info' | 'warn' | 'error' | 'critical';

/**
 * Base audit event structure
 */
export interface K8sAuditEvent {
  /** Timestamp in ISO 8601 format */
  timestamp: string;

  /** Event type */
  event: K8sAuditEventType;

  /** Severity level */
  severity: K8sAuditSeverity;

  /** Component that generated the event */
  component:
    | 'k8s-provider'
    | 'k8s-sandbox'
    | 'k8s-network-policy'
    | 'k8s-rbac'
    | 'k8s-security'
    | 'k8s-warm-pool';

  /** Kubernetes namespace */
  namespace?: string;

  /** Resource name (pod, policy, etc.) */
  resourceName?: string;

  /** Sandbox ID */
  sandboxId?: string;

  /** Project ID */
  projectId?: string;

  /** User or agent that triggered the event */
  actor?: string;

  /** Additional context-specific data */
  metadata?: Record<string, unknown>;

  /** Error message if applicable */
  error?: string;

  /** Duration in milliseconds (for timed operations) */
  durationMs?: number;
}

/**
 * K8s Security Audit Logger
 */
export class K8sAuditLogger {
  private enabled: boolean;
  private logFn: (event: K8sAuditEvent) => void;

  constructor(options?: { enabled?: boolean; logFn?: (event: K8sAuditEvent) => void }) {
    this.enabled = options?.enabled ?? true;
    this.logFn = options?.logFn ?? this.defaultLogFn;
  }

  /**
   * Log a pod creation event
   */
  logPodCreated(params: {
    podName: string;
    namespace: string;
    sandboxId: string;
    projectId: string;
    image: string;
    durationMs?: number;
  }): void {
    this.log({
      event: 'pod.created',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
      projectId: params.projectId,
      metadata: { image: params.image },
      durationMs: params.durationMs,
    });
  }

  /**
   * Log a pod started event
   */
  logPodStarted(params: { podName: string; namespace: string; sandboxId: string }): void {
    this.log({
      event: 'pod.started',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
    });
  }

  /**
   * Log a pod stopped event
   */
  logPodStopped(params: {
    podName: string;
    namespace: string;
    sandboxId: string;
    reason?: string;
  }): void {
    this.log({
      event: 'pod.stopped',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
      metadata: params.reason ? { reason: params.reason } : undefined,
    });
  }

  /**
   * Log a pod deletion event
   */
  logPodDeleted(params: { podName: string; namespace: string; sandboxId: string }): void {
    this.log({
      event: 'pod.deleted',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
    });
  }

  /**
   * Log a pod failure event
   */
  logPodFailed(params: {
    podName: string;
    namespace: string;
    sandboxId: string;
    error: string;
  }): void {
    this.log({
      event: 'pod.failed',
      severity: 'error',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
      error: params.error,
    });
  }

  /**
   * Log a network policy creation event
   */
  logNetworkPolicyCreated(params: {
    policyName: string;
    namespace: string;
    sandboxId?: string;
    egressRules?: number;
  }): void {
    this.log({
      event: 'network_policy.created',
      severity: 'info',
      component: 'k8s-network-policy',
      namespace: params.namespace,
      resourceName: params.policyName,
      sandboxId: params.sandboxId,
      metadata: { egressRules: params.egressRules },
    });
  }

  /**
   * Log a network policy update event
   */
  logNetworkPolicyUpdated(params: {
    policyName: string;
    namespace: string;
    changes?: Record<string, unknown>;
  }): void {
    this.log({
      event: 'network_policy.updated',
      severity: 'info',
      component: 'k8s-network-policy',
      namespace: params.namespace,
      resourceName: params.policyName,
      metadata: params.changes,
    });
  }

  /**
   * Log a network policy deletion event
   */
  logNetworkPolicyDeleted(params: {
    policyName: string;
    namespace: string;
    sandboxId?: string;
  }): void {
    this.log({
      event: 'network_policy.deleted',
      severity: 'info',
      component: 'k8s-network-policy',
      namespace: params.namespace,
      resourceName: params.policyName,
      sandboxId: params.sandboxId,
    });
  }

  /**
   * Log network policy configuration change
   */
  logNetworkPolicyConfigChanged(params: {
    namespace: string;
    enabled: boolean;
    allowedEgressHosts?: string[];
  }): void {
    this.log({
      event: params.enabled ? 'config.network_policy_enabled' : 'config.network_policy_disabled',
      severity: 'info',
      component: 'k8s-network-policy',
      namespace: params.namespace,
      metadata: { allowedEgressHosts: params.allowedEgressHosts },
    });
  }

  /**
   * Log an RBAC resource creation event
   */
  logRbacCreated(params: {
    resourceType:
      | 'service_account'
      | 'role'
      | 'role_binding'
      | 'cluster_role'
      | 'cluster_role_binding';
    resourceName: string;
    namespace?: string;
  }): void {
    const eventMap = {
      service_account: 'rbac.service_account_created',
      role: 'rbac.role_created',
      role_binding: 'rbac.role_binding_created',
      cluster_role: 'rbac.cluster_role_created',
      cluster_role_binding: 'rbac.cluster_role_binding_created',
    } as const;

    this.log({
      event: eventMap[params.resourceType],
      severity: 'info',
      component: 'k8s-rbac',
      namespace: params.namespace,
      resourceName: params.resourceName,
    });
  }

  /**
   * Log a command execution event
   */
  logExecCommand(params: {
    podName: string;
    namespace: string;
    sandboxId: string;
    command: string;
    exitCode: number;
    durationMs?: number;
  }): void {
    this.log({
      event: 'security.exec_command',
      severity: params.exitCode === 0 ? 'info' : 'warn',
      component: 'k8s-sandbox',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
      metadata: {
        command: params.command,
        exitCode: params.exitCode,
      },
      durationMs: params.durationMs,
    });
  }

  /**
   * Log an attempted root execution (which is blocked)
   */
  logExecAsRootAttempted(params: {
    podName: string;
    namespace: string;
    sandboxId: string;
    command: string;
  }): void {
    this.log({
      event: 'security.exec_as_root_attempted',
      severity: 'warn',
      component: 'k8s-sandbox',
      namespace: params.namespace,
      resourceName: params.podName,
      sandboxId: params.sandboxId,
      metadata: { command: params.command },
    });
  }

  /**
   * Log Pod Security Standards validation result
   */
  logPssValidation(params: {
    podName: string;
    namespace: string;
    passed: boolean;
    profile: 'baseline' | 'restricted';
    violations?: string[];
  }): void {
    this.log({
      event: params.passed ? 'security.pss_validation_passed' : 'security.pss_validation_failed',
      severity: params.passed ? 'info' : 'error',
      component: 'k8s-security',
      namespace: params.namespace,
      resourceName: params.podName,
      metadata: {
        profile: params.profile,
        violations: params.violations,
      },
    });
  }

  /**
   * Log a namespace creation event
   */
  logNamespaceCreated(params: { namespace: string; labels?: Record<string, string> }): void {
    this.log({
      event: 'namespace.created',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.namespace,
      metadata: { labels: params.labels },
    });
  }

  /**
   * Log warm pool prewarm event
   */
  logWarmPoolPrewarm(params: {
    poolId: string;
    namespace: string;
    requested: number;
    created: number;
    currentPoolSize: number;
  }): void {
    this.log({
      event: 'warm_pool.prewarm',
      severity: 'info',
      component: 'k8s-warm-pool',
      namespace: params.namespace,
      resourceName: params.poolId,
      metadata: {
        requested: params.requested,
        created: params.created,
        currentPoolSize: params.currentPoolSize,
      },
    });
  }

  /**
   * Log warm pool allocation event
   */
  logWarmPoolAllocation(params: {
    podName: string;
    namespace: string;
    projectId: string;
    allocationTimeMs: number;
    remainingWarmPods: number;
  }): void {
    this.log({
      event: 'warm_pool.allocation',
      severity: 'info',
      component: 'k8s-warm-pool',
      namespace: params.namespace,
      resourceName: params.podName,
      projectId: params.projectId,
      metadata: {
        allocationTimeMs: params.allocationTimeMs,
        remainingWarmPods: params.remainingWarmPods,
      },
    });
  }

  /**
   * Log warm pool pod creation event
   */
  logWarmPoolPodCreated(params: { podName: string; namespace: string }): void {
    this.log({
      event: 'warm_pool.pod_created',
      severity: 'info',
      component: 'k8s-warm-pool',
      namespace: params.namespace,
      resourceName: params.podName,
    });
  }

  /**
   * Log warm pool pod deletion event
   */
  logWarmPoolPodDeleted(params: { podName: string; namespace: string }): void {
    this.log({
      event: 'warm_pool.pod_deleted',
      severity: 'info',
      component: 'k8s-warm-pool',
      namespace: params.namespace,
      resourceName: params.podName,
    });
  }

  /**
   * Log warm pool discovery event
   */
  logWarmPoolDiscovery(params: {
    poolId: string;
    namespace: string;
    warmPodsDiscovered: number;
    allocatedPodsDiscovered: number;
  }): void {
    this.log({
      event: 'warm_pool.discovery',
      severity: 'info',
      component: 'k8s-warm-pool',
      namespace: params.namespace,
      resourceName: params.poolId,
      metadata: {
        warmPodsDiscovered: params.warmPodsDiscovered,
        allocatedPodsDiscovered: params.allocatedPodsDiscovered,
      },
    });
  }

  /**
   * Log PVC creation event
   */
  logPvcCreated(params: { pvcName: string; namespace: string; sandboxId: string; storageSize: string }): void {
    this.log({
      event: 'pvc.created',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.pvcName,
      sandboxId: params.sandboxId,
      metadata: { storageSize: params.storageSize },
    });
  }

  /**
   * Log PVC deletion event
   */
  logPvcDeleted(params: { pvcName: string; namespace: string; sandboxId: string }): void {
    this.log({
      event: 'pvc.deleted',
      severity: 'info',
      component: 'k8s-provider',
      namespace: params.namespace,
      resourceName: params.pvcName,
      sandboxId: params.sandboxId,
    });
  }

  /**
   * Enable or disable logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Core log method
   */
  private log(event: Omit<K8sAuditEvent, 'timestamp'>): void {
    if (!this.enabled) {
      return;
    }

    const fullEvent: K8sAuditEvent = {
      timestamp: new Date().toISOString(),
      ...event,
    };

    this.logFn(fullEvent);
  }

  /**
   * Default log function (writes to stdout as JSON)
   */
  private defaultLogFn(event: K8sAuditEvent): void {
    // Format: [K8S_AUDIT] <JSON>
    const prefix = `[K8S_AUDIT]`;
    const json = JSON.stringify(event);
    console.log(`${prefix} ${json}`);
  }
}

/**
 * Singleton audit logger instance
 */
let auditLoggerInstance: K8sAuditLogger | null = null;

/**
 * Get the shared audit logger instance
 */
export function getK8sAuditLogger(): K8sAuditLogger {
  if (!auditLoggerInstance) {
    auditLoggerInstance = new K8sAuditLogger();
  }
  return auditLoggerInstance;
}

/**
 * Create a new audit logger with custom options
 */
export function createK8sAuditLogger(options?: {
  enabled?: boolean;
  logFn?: (event: K8sAuditEvent) => void;
}): K8sAuditLogger {
  return new K8sAuditLogger(options);
}
