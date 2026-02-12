import type { V1PodTemplateSpec } from '@kubernetes/client-node';
import type { Condition, CRDResource, CRDResourceList } from './common.js';

/**
 * Sandbox spec
 */
export interface SandboxSpec {
  /** Reference to a SandboxTemplate */
  sandboxTemplateRef?: {
    name: string;
    namespace?: string;
  };

  /** Inline pod template (alternative to templateRef) */
  podTemplate?: V1PodTemplateSpec;

  /** Number of replicas (0 = paused, 1 = running) */
  replicas?: number;

  /** Network policy configuration */
  networkPolicy?: SandboxNetworkPolicy;

  /** Volume claims for persistent storage */
  volumeClaims?: SandboxVolumeClaim[];

  /** Runtime class name (e.g., "gvisor", "kata") */
  runtimeClassName?: string;

  /** Time-to-live after completion */
  ttlSecondsAfterFinished?: number;
}

/**
 * Network policy embedded in sandbox spec
 */
export interface SandboxNetworkPolicy {
  egress?: SandboxNetworkRule[];
  ingress?: SandboxNetworkRule[];
}

/**
 * Network rule
 */
export interface SandboxNetworkRule {
  ports?: Array<{ port: number; protocol: string }>;
  to?: Array<{ ipBlock?: { cidr: string; except?: string[] } }>;
  from?: Array<{ ipBlock?: { cidr: string; except?: string[] } }>;
}

/**
 * Volume claim in sandbox
 */
export interface SandboxVolumeClaim {
  name: string;
  storageClassName?: string;
  accessModes: string[];
  resources: {
    requests: { storage: string };
  };
}

/**
 * Sandbox status
 */
export interface SandboxStatus {
  /** Current phase */
  phase?: 'Pending' | 'Running' | 'Paused' | 'Succeeded' | 'Failed' | 'Unknown';

  /** Standard conditions */
  conditions?: Condition[];

  /** Pod name backing this sandbox */
  podName?: string;

  /** Stable service FQDN */
  serviceFQDN?: string;

  /** IP address of the sandbox pod */
  podIP?: string;

  /** Ready replicas count */
  readyReplicas?: number;

  /** When the sandbox became ready */
  readyAt?: string;
}

/**
 * Full Sandbox resource
 */
export type Sandbox = CRDResource<SandboxSpec, SandboxStatus>;

/**
 * Sandbox list
 */
export type SandboxList = CRDResourceList<Sandbox>;
