import type { Condition, CRDResource, CRDResourceList } from './common.js';

/**
 * SandboxWarmPool spec
 */
export interface SandboxWarmPoolSpec {
  /** Number of warm replicas to maintain */
  replicas: number;

  /** Reference to the SandboxTemplate used for pool members */
  sandboxTemplateRef: {
    name: string;
    namespace?: string;
  };

  /** Minimum replicas (for autoscaling) */
  minReplicas?: number;

  /** Maximum replicas (for autoscaling) */
  maxReplicas?: number;
}

/**
 * SandboxWarmPool status
 */
export interface SandboxWarmPoolStatus {
  /** Number of ready warm sandboxes */
  readyReplicas?: number;

  /** Number of allocated sandboxes */
  allocatedReplicas?: number;

  /** Total replicas (warm + allocated) */
  replicas?: number;

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
