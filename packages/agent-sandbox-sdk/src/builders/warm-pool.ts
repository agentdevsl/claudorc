import { CRD_API, CRD_KINDS } from '../constants.js';
import type { SandboxWarmPool, SandboxWarmPoolSpec } from '../types/warm-pool.js';

export class SandboxWarmPoolBuilder {
  private resource: {
    apiVersion: string;
    kind: string;
    metadata: {
      name: string;
      namespace?: string;
      labels?: Record<string, string>;
    };
    spec: Partial<SandboxWarmPoolSpec>;
  };

  constructor(name: string) {
    this.resource = {
      apiVersion: CRD_API.extensionsApiVersion,
      kind: CRD_KINDS.sandboxWarmPool,
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

  /** Set desired replica count */
  replicas(count: number): this {
    this.resource.spec.replicas = count;
    return this;
  }

  /** Reference the template */
  templateRef(name: string, namespace?: string): this {
    this.resource.spec.sandboxTemplateRef = { name, namespace };
    return this;
  }

  /** Set autoscaling bounds */
  autoscale(min: number, max: number): this {
    this.resource.spec.minReplicas = min;
    this.resource.spec.maxReplicas = max;
    return this;
  }

  /** Build the SandboxWarmPool resource */
  build(): SandboxWarmPool {
    return this.resource as SandboxWarmPool;
  }
}
