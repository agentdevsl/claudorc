import type { Condition, CRDResource, CRDResourceList } from './common.js';

/**
 * SandboxClaim spec -- used to request a sandbox from a warm pool
 */
export interface SandboxClaimSpec {
  /** Reference to the SandboxTemplate */
  sandboxTemplateRef: {
    name: string;
    namespace?: string;
  };

  /** Reference to the WarmPool to claim from */
  warmPoolRef?: {
    name: string;
    namespace?: string;
  };
}

/**
 * SandboxClaim status
 */
export interface SandboxClaimStatus {
  /** Phase of the claim */
  phase?: 'Pending' | 'Bound' | 'Failed';

  /** Name of the sandbox bound to this claim */
  sandboxRef?: {
    name: string;
    namespace?: string;
  };

  /** Conditions */
  conditions?: Condition[];

  /** When the claim was bound */
  boundAt?: string;
}

/**
 * Full SandboxClaim resource
 */
export type SandboxClaim = CRDResource<SandboxClaimSpec, SandboxClaimStatus>;

/**
 * SandboxClaim list
 */
export type SandboxClaimList = CRDResourceList<SandboxClaim>;
