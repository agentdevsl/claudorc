// Bun compatibility — apply patches before any k8s client usage
export { applyBunCompat } from './bun-compat.js';

import { applyBunCompat } from './bun-compat.js';

applyBunCompat();

// Client

export { SandboxClaimBuilder } from './builders/claim.js';
// Builders
export { SandboxBuilder } from './builders/sandbox.js';
export { SandboxTemplateBuilder } from './builders/template.js';
export { SandboxWarmPoolBuilder } from './builders/warm-pool.js';
export type { AgentSandboxClientOptions } from './client.js';
export { AgentSandboxClient } from './client.js';
// Constants
export {
  CRD_ANNOTATIONS,
  CRD_API,
  CRD_CONDITIONS,
  CRD_KINDS,
  CRD_LABELS,
  CRD_PLURALS,
} from './constants.js';
// Errors
export {
  AgentSandboxError,
  AlreadyExistsError,
  ControllerNotInstalledError,
  ExecError,
  KubeConfigError,
  NotFoundError,
  TimeoutError,
} from './errors.js';
export type { KubeConfigOptions } from './kubeconfig.js';
// KubeConfig
export { getClusterInfo, loadKubeConfig, resolveContext } from './kubeconfig.js';
export type { CrudConfig, ListOptions } from './operations/crud.js';
// Operations
export { CustomResourceCrud } from './operations/crud.js';
export { execInSandbox, execStreamInSandbox } from './operations/exec.js';
export type { WaitForReadyOptions } from './operations/lifecycle.js';
export { pause, resume, waitForReady } from './operations/lifecycle.js';
export type { WatchCallback, WatchHandle, WatchOptions } from './operations/watch.js';
export { startWatch } from './operations/watch.js';
export {
  sandboxClaimSchema,
  sandboxClaimSpecSchema,
  sandboxClaimStatusSchema,
} from './schemas/claim.js';
// Schemas
export {
  sandboxNetworkRuleSchema,
  sandboxSchema,
  sandboxSpecSchema,
  sandboxStatusSchema,
  sandboxVolumeClaimSchema,
} from './schemas/sandbox.js';
export {
  sandboxTemplateSchema,
  sandboxTemplateSpecSchema,
  sandboxTemplateStatusSchema,
} from './schemas/template.js';
export {
  sandboxWarmPoolSchema,
  sandboxWarmPoolSpecSchema,
  sandboxWarmPoolStatusSchema,
} from './schemas/warm-pool.js';
export type {
  SandboxClaim,
  SandboxClaimList,
  SandboxClaimSpec,
  SandboxClaimStatus,
} from './types/claim.js';
// Types
export type {
  Condition,
  CRDResource,
  CRDResourceList,
  WatchEvent,
  WatchEventType,
} from './types/common.js';
export type {
  ExecOptions,
  ExecResult,
  ExecStreamOptions,
  ExecStreamResult,
} from './types/exec.js';
export type {
  Sandbox,
  SandboxList,
  SandboxNetworkPolicy,
  SandboxNetworkRule,
  SandboxSpec,
  SandboxStatus,
  SandboxVolumeClaim,
} from './types/sandbox.js';
export type {
  SandboxTemplate,
  SandboxTemplateList,
  SandboxTemplateSpec,
  SandboxTemplateStatus,
} from './types/template.js';
export type {
  SandboxWarmPool,
  SandboxWarmPoolList,
  SandboxWarmPoolSpec,
  SandboxWarmPoolStatus,
} from './types/warm-pool.js';
