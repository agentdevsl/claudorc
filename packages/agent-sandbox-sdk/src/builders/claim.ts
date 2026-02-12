import { CRD_API, CRD_KINDS } from '../constants.js';
import type { SandboxClaim, SandboxClaimSpec } from '../types/claim.js';

export class SandboxClaimBuilder {
  private resource: {
    apiVersion: string;
    kind: string;
    metadata: {
      name: string;
      namespace?: string;
      labels?: Record<string, string>;
    };
    spec: Partial<SandboxClaimSpec>;
  };

  constructor(name: string) {
    this.resource = {
      apiVersion: CRD_API.apiVersion,
      kind: CRD_KINDS.sandboxClaim,
      metadata: { name },
      spec: {},
    };
  }

  namespace(ns: string): this {
    this.resource.metadata.namespace = ns;
    return this;
  }

  labels(labels: Record<string, string>): this {
    this.resource.metadata.labels = {
      ...this.resource.metadata.labels,
      ...labels,
    };
    return this;
  }

  /** Reference the template */
  templateRef(name: string, namespace?: string): this {
    this.resource.spec.sandboxTemplateRef = { name, namespace };
    return this;
  }

  /** Reference a warm pool */
  warmPoolRef(name: string, namespace?: string): this {
    this.resource.spec.warmPoolRef = { name, namespace };
    return this;
  }

  /** Build the SandboxClaim resource */
  build(): SandboxClaim {
    return this.resource as SandboxClaim;
  }
}
