// Types

// Credentials Injector
export {
  CredentialsInjector,
  createCredentialsInjector,
  loadHostCredentials,
} from './credentials-injector.js';
// Docker Provider
export { createDockerProvider, DockerProvider } from './providers/docker-provider.js';

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
