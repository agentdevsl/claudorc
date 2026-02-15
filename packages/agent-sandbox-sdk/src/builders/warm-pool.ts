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
      apiVersion: CRD_API.apiVersion,
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

  /** Set desired number of warm sandboxes to keep ready */
  replicas(count: number): this {
    this.resource.spec.desiredReady = count;
    return this;
  }

  /** Reference the template */
  templateRef(name: string, namespace?: string): this {
    this.resource.spec.templateRef = { name, namespace };
    return this;
  }

  /** Set maximum pool size */
  autoscale(max: number): this {
    this.resource.spec.maxSize = max;
    return this;
  }

  /** Build the SandboxWarmPool resource */
  build(): SandboxWarmPool {
    return this.resource as SandboxWarmPool;
  }
}
