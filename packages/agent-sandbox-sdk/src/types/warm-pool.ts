import type { Condition, CRDResource, CRDResourceList } from './common.js';

/**
 * SandboxWarmPool spec
 */
export interface SandboxWarmPoolSpec {
  /** Number of warm sandboxes to keep ready */
  desiredReady: number;

  /** Reference to the SandboxTemplate used for pool members */
  templateRef: {
    name: string;
    namespace?: string;
  };

  /** Maximum pool size (for autoscaling) */
  maxSize?: number;
}

/**
 * SandboxWarmPool status
 */
export interface SandboxWarmPoolStatus {
  /** Number of ready warm sandboxes */
  readyReplicas?: number;

  /** Number of available sandboxes */
  availableReplicas?: number;

  /** Conditions */
  conditions?: Condition[];
}

/**
 * Full SandboxWarmPool resource
 */
export type SandboxWarmPool = CRDResource<SandboxWarmPoolSpec, SandboxWarmPoolStatus>;

/**
 * SandboxWarmPool list
 */
export type SandboxWarmPoolList = CRDResourceList<SandboxWarmPool>;
