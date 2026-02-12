import { describe, expect, it } from 'vitest';
import { SandboxClaimBuilder } from '../src/builders/claim.js';
import { SandboxBuilder } from '../src/builders/sandbox.js';
import { SandboxTemplateBuilder } from '../src/builders/template.js';
import { SandboxWarmPoolBuilder } from '../src/builders/warm-pool.js';
import { CRD_ANNOTATIONS, CRD_API, CRD_KINDS } from '../src/constants.js';

describe('SandboxBuilder', () => {
  it('builds a minimal sandbox with correct apiVersion and kind', () => {
    const sandbox = new SandboxBuilder('my-sandbox').build();

    expect(sandbox.apiVersion).toBe(CRD_API.apiVersion);
    expect(sandbox.kind).toBe(CRD_KINDS.sandbox);
    expect(sandbox.metadata.name).toBe('my-sandbox');
  });

  it('sets namespace', () => {
    const sandbox = new SandboxBuilder('test').namespace('default').build();

    expect(sandbox.metadata.namespace).toBe('default');
  });

  it('sets template ref', () => {
    const sandbox = new SandboxBuilder('test').fromTemplate('my-template').build();

    expect(sandbox.spec.sandboxTemplateRef).toEqual({
      name: 'my-template',
      namespace: undefined,
    });
  });

  it('sets template ref with namespace', () => {
    const sandbox = new SandboxBuilder('test').fromTemplate('my-template', 'template-ns').build();

    expect(sandbox.spec.sandboxTemplateRef).toEqual({
      name: 'my-template',
      namespace: 'template-ns',
    });
  });

  it('builds a sandbox with inline image', () => {
    const sandbox = new SandboxBuilder('test').image('ubuntu:24.04').build();

    const container = sandbox.spec.podTemplate?.spec?.containers?.[0];
    expect(container?.name).toBe('sandbox');
    expect(container?.image).toBe('ubuntu:24.04');
  });

  it('builds a sandbox with image and resources', () => {
    const sandbox = new SandboxBuilder('test')
      .image('ubuntu:24.04')
      .resources({ cpu: '500m', memory: '512Mi' })
      .build();

    const container = sandbox.spec.podTemplate?.spec?.containers?.[0];
    expect(container?.image).toBe('ubuntu:24.04');
    expect(container?.resources?.limits).toEqual({ cpu: '500m', memory: '512Mi' });
  });

  it('resources creates podTemplate if not present', () => {
    const sandbox = new SandboxBuilder('test').resources({ cpu: '1', memory: '1Gi' }).build();

    expect(sandbox.spec.podTemplate).toBeDefined();
    const container = sandbox.spec.podTemplate?.spec?.containers?.[0];
    expect(container?.resources?.limits).toEqual({ cpu: '1', memory: '1Gi' });
  });

  it('sets labels', () => {
    const sandbox = new SandboxBuilder('test').labels({ env: 'test', tier: 'compute' }).build();

    expect(sandbox.metadata.labels).toEqual({ env: 'test', tier: 'compute' });
  });

  it('merges labels on multiple calls', () => {
    const sandbox = new SandboxBuilder('test')
      .labels({ env: 'test' })
      .labels({ tier: 'compute' })
      .build();

    expect(sandbox.metadata.labels).toEqual({ env: 'test', tier: 'compute' });
  });

  it('sets annotations', () => {
    const sandbox = new SandboxBuilder('test').annotations({ custom: 'value' }).build();

    expect(sandbox.metadata.annotations).toEqual({ custom: 'value' });
  });

  it('merges annotations on multiple calls', () => {
    const sandbox = new SandboxBuilder('test')
      .annotations({ first: '1' })
      .annotations({ second: '2' })
      .build();

    expect(sandbox.metadata.annotations).toEqual({ first: '1', second: '2' });
  });

  it('sets agentPaneContext annotations', () => {
    const sandbox = new SandboxBuilder('test')
      .agentPaneContext({ projectId: 'proj-1', taskId: 'task-1', sandboxId: 'sb-1' })
      .build();

    expect(sandbox.metadata.annotations).toEqual({
      [CRD_ANNOTATIONS.projectId]: 'proj-1',
      [CRD_ANNOTATIONS.taskId]: 'task-1',
      [CRD_ANNOTATIONS.sandboxId]: 'sb-1',
    });
  });

  it('agentPaneContext omits optional fields when not provided', () => {
    const sandbox = new SandboxBuilder('test').agentPaneContext({ projectId: 'proj-1' }).build();

    expect(sandbox.metadata.annotations).toEqual({
      [CRD_ANNOTATIONS.projectId]: 'proj-1',
    });
    expect(sandbox.metadata.annotations).not.toHaveProperty(CRD_ANNOTATIONS.taskId);
    expect(sandbox.metadata.annotations).not.toHaveProperty(CRD_ANNOTATIONS.sandboxId);
  });

  it('agentPaneContext merges with existing annotations', () => {
    const sandbox = new SandboxBuilder('test')
      .annotations({ custom: 'value' })
      .agentPaneContext({ projectId: 'proj-1' })
      .build();

    expect(sandbox.metadata.annotations).toEqual({
      custom: 'value',
      [CRD_ANNOTATIONS.projectId]: 'proj-1',
    });
  });

  it('sets replicas', () => {
    const sandbox = new SandboxBuilder('test').replicas(0).build();

    expect(sandbox.spec.replicas).toBe(0);
  });

  it('sets TTL', () => {
    const sandbox = new SandboxBuilder('test').ttl(3600).build();

    expect(sandbox.spec.ttlSecondsAfterFinished).toBe(3600);
  });

  it('sets runtimeClass', () => {
    const sandbox = new SandboxBuilder('test').runtimeClass('gvisor').build();

    expect(sandbox.spec.runtimeClassName).toBe('gvisor');
  });

  it('sets networkPolicy', () => {
    const sandbox = new SandboxBuilder('test').networkPolicy({ egress: [], ingress: [] }).build();

    expect(sandbox.spec.networkPolicy).toEqual({ egress: [], ingress: [] });
  });

  it('adds volume claims', () => {
    const sandbox = new SandboxBuilder('test')
      .addVolumeClaim({
        name: 'data',
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
      })
      .addVolumeClaim({
        name: 'logs',
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '500Mi' } },
      })
      .build();

    expect(sandbox.spec.volumeClaims).toHaveLength(2);
    expect(sandbox.spec.volumeClaims![0].name).toBe('data');
    expect(sandbox.spec.volumeClaims![1].name).toBe('logs');
  });

  it('sets pod template directly', () => {
    const podTemplate = {
      spec: {
        containers: [{ name: 'custom', image: 'nginx:latest' }],
      },
    };
    const sandbox = new SandboxBuilder('test').withPodTemplate(podTemplate).build();

    expect(sandbox.spec.podTemplate).toEqual(podTemplate);
  });

  it('supports fluent API chaining', () => {
    const sandbox = new SandboxBuilder('full-sandbox')
      .namespace('production')
      .fromTemplate('base-template')
      .labels({ env: 'prod' })
      .annotations({ note: 'test' })
      .replicas(1)
      .ttl(7200)
      .runtimeClass('kata')
      .networkPolicy({ egress: [] })
      .addVolumeClaim({
        name: 'data',
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '10Gi' } },
      })
      .agentPaneContext({ projectId: 'p1', taskId: 't1' })
      .build();

    expect(sandbox.metadata.name).toBe('full-sandbox');
    expect(sandbox.metadata.namespace).toBe('production');
    expect(sandbox.spec.sandboxTemplateRef?.name).toBe('base-template');
    expect(sandbox.spec.replicas).toBe(1);
    expect(sandbox.spec.ttlSecondsAfterFinished).toBe(7200);
    expect(sandbox.spec.runtimeClassName).toBe('kata');
    expect(sandbox.spec.volumeClaims).toHaveLength(1);
  });

  it('image() updates existing podTemplate container', () => {
    const sandbox = new SandboxBuilder('test')
      .withPodTemplate({
        spec: { containers: [{ name: 'sandbox', image: 'old:v1' }] },
      })
      .image('new:v2')
      .build();

    expect(sandbox.spec.podTemplate?.spec?.containers?.[0]?.image).toBe('new:v2');
  });
});

describe('SandboxTemplateBuilder', () => {
  it('builds a template with correct apiVersion and kind', () => {
    const template = new SandboxTemplateBuilder('base-template').build();

    expect(template.apiVersion).toBe(CRD_API.extensionsApiVersion);
    expect(template.kind).toBe(CRD_KINDS.sandboxTemplate);
    expect(template.metadata.name).toBe('base-template');
  });

  it('sets namespace', () => {
    const template = new SandboxTemplateBuilder('test').namespace('default').build();

    expect(template.metadata.namespace).toBe('default');
  });

  it('builds a template with image and resources', () => {
    const template = new SandboxTemplateBuilder('test')
      .image('node:22')
      .resources({ cpu: '1', memory: '1Gi' })
      .build();

    const container = template.spec.podTemplate?.spec?.containers?.[0];
    expect(container?.image).toBe('node:22');
    expect(container?.resources?.limits).toEqual({ cpu: '1', memory: '1Gi' });
  });

  it('sets labels', () => {
    const template = new SandboxTemplateBuilder('test').labels({ tier: 'base' }).build();

    expect(template.metadata.labels).toEqual({ tier: 'base' });
  });

  it('sets runtimeClass', () => {
    const template = new SandboxTemplateBuilder('test').runtimeClass('kata').build();

    expect(template.spec.runtimeClassName).toBe('kata');
  });

  it('sets networkPolicy', () => {
    const template = new SandboxTemplateBuilder('test').networkPolicy({ egress: [] }).build();

    expect(template.spec.networkPolicy).toEqual({ egress: [] });
  });

  it('adds volume claims', () => {
    const template = new SandboxTemplateBuilder('test')
      .addVolumeClaim({
        name: 'workspace',
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '5Gi' } },
      })
      .build();

    expect(template.spec.volumeClaims).toHaveLength(1);
    expect(template.spec.volumeClaims![0].name).toBe('workspace');
  });

  it('sets podTemplate directly', () => {
    const podTemplate = {
      spec: {
        containers: [{ name: 'sandbox', image: 'ubuntu:24.04' }],
      },
    };
    const template = new SandboxTemplateBuilder('test').podTemplate(podTemplate).build();

    expect(template.spec.podTemplate).toEqual(podTemplate);
  });

  it('supports fluent chaining', () => {
    const template = new SandboxTemplateBuilder('full-template')
      .namespace('templates')
      .labels({ version: 'v1' })
      .image('python:3.12')
      .resources({ cpu: '2', memory: '4Gi' })
      .runtimeClass('gvisor')
      .networkPolicy({ ingress: [] })
      .addVolumeClaim({
        name: 'data',
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '10Gi' } },
      })
      .build();

    expect(template.metadata.name).toBe('full-template');
    expect(template.spec.runtimeClassName).toBe('gvisor');
  });
});

describe('SandboxClaimBuilder', () => {
  it('builds a claim with correct apiVersion and kind', () => {
    const claim = new SandboxClaimBuilder('my-claim').build();

    expect(claim.apiVersion).toBe(CRD_API.apiVersion);
    expect(claim.kind).toBe(CRD_KINDS.sandboxClaim);
    expect(claim.metadata.name).toBe('my-claim');
  });

  it('sets namespace', () => {
    const claim = new SandboxClaimBuilder('test').namespace('default').build();

    expect(claim.metadata.namespace).toBe('default');
  });

  it('sets template ref', () => {
    const claim = new SandboxClaimBuilder('test').templateRef('my-template').build();

    expect(claim.spec.sandboxTemplateRef).toEqual({
      name: 'my-template',
      namespace: undefined,
    });
  });

  it('sets template ref with namespace', () => {
    const claim = new SandboxClaimBuilder('test').templateRef('my-template', 'tpl-ns').build();

    expect(claim.spec.sandboxTemplateRef).toEqual({
      name: 'my-template',
      namespace: 'tpl-ns',
    });
  });

  it('sets warm pool ref', () => {
    const claim = new SandboxClaimBuilder('test').warmPoolRef('my-pool', 'pool-ns').build();

    expect(claim.spec.warmPoolRef).toEqual({
      name: 'my-pool',
      namespace: 'pool-ns',
    });
  });

  it('sets labels', () => {
    const claim = new SandboxClaimBuilder('test').labels({ app: 'test' }).build();

    expect(claim.metadata.labels).toEqual({ app: 'test' });
  });

  it('supports fluent chaining', () => {
    const claim = new SandboxClaimBuilder('my-claim')
      .namespace('default')
      .templateRef('my-template')
      .warmPoolRef('my-pool')
      .labels({ app: 'test' })
      .build();

    expect(claim.metadata.name).toBe('my-claim');
    expect(claim.metadata.namespace).toBe('default');
    expect(claim.spec.sandboxTemplateRef?.name).toBe('my-template');
    expect(claim.spec.warmPoolRef?.name).toBe('my-pool');
  });
});

describe('SandboxWarmPoolBuilder', () => {
  it('builds a warm pool with correct apiVersion and kind', () => {
    const pool = new SandboxWarmPoolBuilder('my-pool').build();

    expect(pool.apiVersion).toBe(CRD_API.extensionsApiVersion);
    expect(pool.kind).toBe(CRD_KINDS.sandboxWarmPool);
    expect(pool.metadata.name).toBe('my-pool');
  });

  it('sets namespace', () => {
    const pool = new SandboxWarmPoolBuilder('test').namespace('default').build();

    expect(pool.metadata.namespace).toBe('default');
  });

  it('sets replicas', () => {
    const pool = new SandboxWarmPoolBuilder('test').replicas(3).build();

    expect(pool.spec.replicas).toBe(3);
  });

  it('sets template ref', () => {
    const pool = new SandboxWarmPoolBuilder('test').templateRef('base-template').build();

    expect(pool.spec.sandboxTemplateRef).toEqual({
      name: 'base-template',
      namespace: undefined,
    });
  });

  it('sets template ref with namespace', () => {
    const pool = new SandboxWarmPoolBuilder('test').templateRef('base-template', 'tpl-ns').build();

    expect(pool.spec.sandboxTemplateRef).toEqual({
      name: 'base-template',
      namespace: 'tpl-ns',
    });
  });

  it('sets autoscaling bounds', () => {
    const pool = new SandboxWarmPoolBuilder('test').autoscale(1, 10).build();

    expect(pool.spec.minReplicas).toBe(1);
    expect(pool.spec.maxReplicas).toBe(10);
  });

  it('sets labels', () => {
    const pool = new SandboxWarmPoolBuilder('test').labels({ tier: 'warm' }).build();

    expect(pool.metadata.labels).toEqual({ tier: 'warm' });
  });

  it('supports fluent chaining', () => {
    const pool = new SandboxWarmPoolBuilder('my-pool')
      .namespace('default')
      .replicas(3)
      .templateRef('base-template')
      .autoscale(1, 10)
      .labels({ tier: 'warm' })
      .build();

    expect(pool.metadata.name).toBe('my-pool');
    expect(pool.metadata.namespace).toBe('default');
    expect(pool.spec.replicas).toBe(3);
    expect(pool.spec.sandboxTemplateRef?.name).toBe('base-template');
    expect(pool.spec.minReplicas).toBe(1);
    expect(pool.spec.maxReplicas).toBe(10);
  });
});
