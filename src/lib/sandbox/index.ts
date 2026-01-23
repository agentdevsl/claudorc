// Types

// Credentials Injector
export {
  CredentialsInjector,
  createCredentialsInjector,
  loadHostCredentials,
} from './credentials-injector.js';
// Docker Provider
export { createDockerProvider, DockerProvider } from './providers/docker-provider.js';

// Kubernetes Provider
export { createK8sProvider, K8sProvider } from './providers/k8s-provider.js';
export type { K8sProviderOptions } from './providers/k8s-config.js';
export { K8S_PROVIDER_DEFAULTS, K8S_POD_LABELS } from './providers/k8s-config.js';

// Kubernetes Security (Phase 4)
export {
  createNetworkPolicyManager,
  K8sNetworkPolicyManager,
  NETWORK_POLICY_DEFAULTS,
  NETWORK_POLICY_NAMES,
  PRIVATE_IP_RANGES,
} from './providers/k8s-network-policy.js';
export type { NetworkPolicyConfig } from './providers/k8s-network-policy.js';

export { createRbacManager, K8sRbacManager, RBAC_NAMES } from './providers/k8s-rbac.js';

export {
  createK8sAuditLogger,
  getK8sAuditLogger,
  K8sAuditLogger,
} from './providers/k8s-audit.js';
export type { K8sAuditEvent, K8sAuditEventType, K8sAuditSeverity } from './providers/k8s-audit.js';

export {
  createPodSecurityValidator,
  ensureRestrictedPodSecurity,
  getPodSecurityValidator,
  PodSecurityValidator,
} from './providers/k8s-security.js';
export type { PssProfile, PssValidationResult } from './providers/k8s-security.js';

// Kubernetes Warm Pool (Phase 5)
export {
  createWarmPoolController,
  K8S_WARM_POOL_LABELS,
  WARM_POOL_DEFAULTS,
  WarmPoolController,
} from './providers/k8s-warm-pool.js';
export type {
  WarmPodInfo,
  WarmPoolConfig,
  WarmPoolMetrics,
  WarmPoolPodState,
} from './providers/k8s-warm-pool.js';

// Provider Interface
export type {
  EventEmittingSandboxProvider,
  Sandbox,
  SandboxProvider,
  SandboxProviderEvent,
  SandboxProviderEventListener,
} from './providers/sandbox-provider.js';
// tmux Manager
export type { CreateTmuxSessionOptions, TmuxExecOptions } from './tmux-manager.js';
export { createTmuxManager, TmuxManager } from './tmux-manager.js';
export type {
  ExecResult,
  OAuthCredentials,
  ProjectSandboxConfig,
  SandboxConfig,
  SandboxHealthCheck,
  SandboxInfo,
  SandboxMetrics,
  SandboxStatus,
  TmuxSession,
  VolumeMountConfig,
} from './types.js';
export {
  projectSandboxConfigSchema,
  SANDBOX_DEFAULTS,
  sandboxConfigSchema,
  volumeMountConfigSchema,
} from './types.js';
