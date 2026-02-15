import type { V1PodTemplateSpec } from '@kubernetes/client-node';
import type { CRDResource, CRDResourceList } from './common.js';
import type { SandboxNetworkPolicy } from './sandbox.js';

/**
 * SandboxTemplate spec
 */
export interface SandboxTemplateSpec {
  /** Pod template spec for sandboxes created from this template */
  podTemplateSpec: V1PodTemplateSpec;

  /** Default network policy for sandboxes */
  networkPolicy?: SandboxNetworkPolicy;

  /** Default runtime class */
  runtimeClassName?: string;

  /** Default volume claims */
  volumeClaims?: Array<{
    name: string;
    storageClassName?: string;
    accessModes: string[];
    resources: { requests: { storage: string } };
  }>;
}

/**
 * SandboxTemplate status
 */
export interface SandboxTemplateStatus {
  /** Number of sandboxes using this template */
  sandboxCount?: number;
}

/**
 * Full SandboxTemplate resource
 */
export type SandboxTemplate = CRDResource<SandboxTemplateSpec, SandboxTemplateStatus>;

/**
 * SandboxTemplate list
 */
export type SandboxTemplateList = CRDResourceList<SandboxTemplate>;
