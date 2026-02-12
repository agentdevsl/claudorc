import type { V1PodTemplateSpec } from '@kubernetes/client-node';
import { CRD_API, CRD_KINDS } from '../constants.js';
import type { SandboxNetworkPolicy, SandboxVolumeClaim } from '../types/sandbox.js';
import type { SandboxTemplate, SandboxTemplateSpec } from '../types/template.js';

export class SandboxTemplateBuilder {
  private resource: {
    apiVersion: string;
    kind: string;
    metadata: {
      name: string;
      namespace?: string;
      labels?: Record<string, string>;
    };
    spec: Partial<SandboxTemplateSpec>;
  };

  constructor(name: string) {
    this.resource = {
      apiVersion: CRD_API.extensionsApiVersion,
      kind: CRD_KINDS.sandboxTemplate,
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

  /** Set the pod template */
  podTemplate(template: V1PodTemplateSpec): this {
    this.resource.spec.podTemplate = template;
    return this;
  }

  /** Set container image */
  image(image: string): this {
    if (!this.resource.spec.podTemplate) {
      this.resource.spec.podTemplate = {
        spec: { containers: [{ name: 'sandbox', image }] },
      };
    } else {
      const containers = this.resource.spec.podTemplate.spec?.containers;
      if (containers && containers.length > 0 && containers[0]) {
        containers[0].image = image;
      } else {
        this.resource.spec.podTemplate.spec = {
          ...this.resource.spec.podTemplate.spec,
          containers: [{ name: 'sandbox', image }],
        };
      }
    }
    return this;
  }

  /** Set resource limits */
  resources(limits: { cpu: string; memory: string }): this {
    if (!this.resource.spec.podTemplate) {
      this.resource.spec.podTemplate = {
        spec: {
          containers: [{ name: 'sandbox', resources: { limits } }],
        },
      };
    } else {
      const containers = this.resource.spec.podTemplate.spec?.containers;
      if (containers && containers.length > 0 && containers[0]) {
        containers[0].resources = { ...containers[0].resources, limits };
      }
    }
    return this;
  }

  /** Set runtime class */
  runtimeClass(name: string): this {
    this.resource.spec.runtimeClassName = name;
    return this;
  }

  /** Set network policy */
  networkPolicy(policy: SandboxNetworkPolicy): this {
    this.resource.spec.networkPolicy = policy;
    return this;
  }

  /** Add volume claim template */
  addVolumeClaim(claim: SandboxVolumeClaim): this {
    if (!this.resource.spec.volumeClaims) {
      this.resource.spec.volumeClaims = [];
    }
    this.resource.spec.volumeClaims.push(claim);
    return this;
  }

  /** Build the SandboxTemplate resource */
  build(): SandboxTemplate {
    return this.resource as SandboxTemplate;
  }
}
