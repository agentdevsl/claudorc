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
