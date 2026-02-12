import { describe, expect, it } from 'vitest';
import { sandboxClaimSchema, sandboxClaimSpecSchema } from '../src/schemas/claim.js';
import {
  sandboxSchema,
  sandboxSpecSchema,
  sandboxStatusSchema,
  sandboxVolumeClaimSchema,
} from '../src/schemas/sandbox.js';
import { sandboxTemplateSchema, sandboxTemplateSpecSchema } from '../src/schemas/template.js';
import { sandboxWarmPoolSchema, sandboxWarmPoolSpecSchema } from '../src/schemas/warm-pool.js';

describe('sandboxSchema', () => {
  const validSandbox = {
    apiVersion: 'agents.x-k8s.io/v1alpha1',
    kind: 'Sandbox',
    metadata: { name: 'test-sandbox' },
    spec: {},
  };

  it('accepts a valid minimal sandbox', () => {
    const result = sandboxSchema.safeParse(validSandbox);
    expect(result.success).toBe(true);
  });

  it('accepts a sandbox with template ref', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      spec: {
        sandboxTemplateRef: { name: 'my-template' },
        replicas: 1,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts sandbox with template ref and namespace', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      spec: {
        sandboxTemplateRef: { name: 'my-template', namespace: 'tpl-ns' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects sandbox with invalid kind', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      kind: 'Pod',
    });
    expect(result.success).toBe(false);
  });

  it('rejects sandbox without metadata.name', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      metadata: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects sandbox without apiVersion', () => {
    const { apiVersion: _, ...noApiVersion } = validSandbox;
    const result = sandboxSchema.safeParse(noApiVersion);
    expect(result.success).toBe(false);
  });

  it('accepts sandbox with status', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      status: {
        phase: 'Running',
        podName: 'test-pod',
        podIP: '10.0.0.1',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts sandbox with labels and annotations', () => {
    const result = sandboxSchema.safeParse({
      ...validSandbox,
      metadata: {
        name: 'test',
        namespace: 'default',
        labels: { app: 'test' },
        annotations: { note: 'hello' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts sandbox without status (optional)', () => {
    const result = sandboxSchema.safeParse(validSandbox);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });
});

describe('sandboxSpecSchema', () => {
  it('accepts empty spec', () => {
    const result = sandboxSpecSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts spec with replicas 0', () => {
    const result = sandboxSpecSchema.safeParse({ replicas: 0 });
    expect(result.success).toBe(true);
  });

  it('accepts spec with replicas 1', () => {
    const result = sandboxSpecSchema.safeParse({ replicas: 1 });
    expect(result.success).toBe(true);
  });

  it('rejects spec with replicas > 1', () => {
    const result = sandboxSpecSchema.safeParse({ replicas: 2 });
    expect(result.success).toBe(false);
  });

  it('rejects spec with negative replicas', () => {
    const result = sandboxSpecSchema.safeParse({ replicas: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects spec with non-integer replicas', () => {
    const result = sandboxSpecSchema.safeParse({ replicas: 0.5 });
    expect(result.success).toBe(false);
  });

  it('accepts spec with runtimeClassName', () => {
    const result = sandboxSpecSchema.safeParse({ runtimeClassName: 'gvisor' });
    expect(result.success).toBe(true);
  });

  it('accepts spec with ttlSecondsAfterFinished', () => {
    const result = sandboxSpecSchema.safeParse({ ttlSecondsAfterFinished: 3600 });
    expect(result.success).toBe(true);
  });

  it('rejects negative ttlSecondsAfterFinished', () => {
    const result = sandboxSpecSchema.safeParse({ ttlSecondsAfterFinished: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts spec with networkPolicy', () => {
    const result = sandboxSpecSchema.safeParse({
      networkPolicy: {
        egress: [{ ports: [{ port: 443, protocol: 'TCP' }] }],
        ingress: [],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts spec with volumeClaims', () => {
    const result = sandboxSpecSchema.safeParse({
      volumeClaims: [
        {
          name: 'data',
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('sandboxStatusSchema', () => {
  it('accepts valid phases', () => {
    for (const phase of ['Pending', 'Running', 'Paused', 'Succeeded', 'Failed', 'Unknown']) {
      const result = sandboxStatusSchema.safeParse({ phase });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid phase', () => {
    const result = sandboxStatusSchema.safeParse({ phase: 'InvalidPhase' });
    expect(result.success).toBe(false);
  });

  it('accepts status with all fields', () => {
    const result = sandboxStatusSchema.safeParse({
      phase: 'Running',
      podName: 'sandbox-pod',
      serviceFQDN: 'sandbox.default.svc.cluster.local',
      podIP: '10.0.0.1',
      readyReplicas: 1,
      readyAt: '2026-01-01T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('accepts empty status', () => {
    const result = sandboxStatusSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('sandboxVolumeClaimSchema', () => {
  it('accepts valid volume claim', () => {
    const result = sandboxVolumeClaimSchema.safeParse({
      name: 'data',
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '1Gi' } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts volume claim with storageClassName', () => {
    const result = sandboxVolumeClaimSchema.safeParse({
      name: 'data',
      storageClassName: 'fast-ssd',
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '10Gi' } },
    });
    expect(result.success).toBe(true);
  });

  it('rejects volume claim without name', () => {
    const result = sandboxVolumeClaimSchema.safeParse({
      accessModes: ['ReadWriteOnce'],
      resources: { requests: { storage: '1Gi' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects volume claim without accessModes', () => {
    const result = sandboxVolumeClaimSchema.safeParse({
      name: 'data',
      resources: { requests: { storage: '1Gi' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects volume claim without resources', () => {
    const result = sandboxVolumeClaimSchema.safeParse({
      name: 'data',
      accessModes: ['ReadWriteOnce'],
    });
    expect(result.success).toBe(false);
  });
});

describe('sandboxTemplateSchema', () => {
  const validTemplate = {
    apiVersion: 'extensions.agents.x-k8s.io/v1alpha1',
    kind: 'SandboxTemplate',
    metadata: { name: 'base' },
    spec: {
      podTemplate: {
        spec: { containers: [{ name: 'sandbox', image: 'ubuntu:24.04' }] },
      },
    },
  };

  it('accepts a valid template', () => {
    const result = sandboxTemplateSchema.safeParse(validTemplate);
    expect(result.success).toBe(true);
  });

  it('rejects template with wrong kind', () => {
    const result = sandboxTemplateSchema.safeParse({
      ...validTemplate,
      kind: 'Sandbox',
    });
    expect(result.success).toBe(false);
  });

  it('rejects template without metadata.name', () => {
    const result = sandboxTemplateSchema.safeParse({
      ...validTemplate,
      metadata: {},
    });
    expect(result.success).toBe(false);
  });

  it('accepts template with status', () => {
    const result = sandboxTemplateSchema.safeParse({
      ...validTemplate,
      status: { sandboxCount: 5 },
    });
    expect(result.success).toBe(true);
  });

  it('accepts template with optional spec fields', () => {
    const result = sandboxTemplateSchema.safeParse({
      ...validTemplate,
      spec: {
        ...validTemplate.spec,
        runtimeClassName: 'gvisor',
        networkPolicy: { egress: [] },
        volumeClaims: [
          {
            name: 'ws',
            accessModes: ['ReadWriteOnce'],
            resources: { requests: { storage: '5Gi' } },
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });
});

describe('sandboxTemplateSpecSchema', () => {
  it('accepts spec with podTemplate as any object', () => {
    const result = sandboxTemplateSpecSchema.safeParse({
      podTemplate: { spec: { containers: [] } },
    });
    expect(result.success).toBe(true);
  });

  it('accepts spec without podTemplate (z.any allows undefined)', () => {
    // podTemplate is typed as z.any() which permits undefined
    const result = sandboxTemplateSpecSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('accepts spec with all optional fields', () => {
    const result = sandboxTemplateSpecSchema.safeParse({
      podTemplate: { spec: { containers: [] } },
      runtimeClassName: 'gvisor',
      networkPolicy: { egress: [], ingress: [] },
      volumeClaims: [
        {
          name: 'data',
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('sandboxClaimSchema', () => {
  const validClaim = {
    apiVersion: 'agents.x-k8s.io/v1alpha1',
    kind: 'SandboxClaim',
    metadata: { name: 'my-claim' },
    spec: {
      sandboxTemplateRef: { name: 'my-template' },
    },
  };

  it('accepts a valid claim', () => {
    const result = sandboxClaimSchema.safeParse(validClaim);
    expect(result.success).toBe(true);
  });

  it('rejects claim without sandboxTemplateRef', () => {
    const result = sandboxClaimSchema.safeParse({
      ...validClaim,
      spec: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects claim with wrong kind', () => {
    const result = sandboxClaimSchema.safeParse({
      ...validClaim,
      kind: 'Sandbox',
    });
    expect(result.success).toBe(false);
  });

  it('accepts claim with warmPoolRef', () => {
    const result = sandboxClaimSchema.safeParse({
      ...validClaim,
      spec: {
        sandboxTemplateRef: { name: 'my-template' },
        warmPoolRef: { name: 'my-pool', namespace: 'pool-ns' },
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts claim with status', () => {
    const result = sandboxClaimSchema.safeParse({
      ...validClaim,
      status: {
        phase: 'Bound',
        sandboxRef: { name: 'sb-123' },
        boundAt: '2026-01-01T00:00:00Z',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects claim status with invalid phase', () => {
    const result = sandboxClaimSchema.safeParse({
      ...validClaim,
      status: { phase: 'Running' },
    });
    expect(result.success).toBe(false);
  });

  it('accepts claim with all valid status phases', () => {
    for (const phase of ['Pending', 'Bound', 'Failed']) {
      const result = sandboxClaimSchema.safeParse({
        ...validClaim,
        status: { phase },
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('sandboxClaimSpecSchema', () => {
  it('requires sandboxTemplateRef', () => {
    const result = sandboxClaimSpecSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('requires sandboxTemplateRef.name', () => {
    const result = sandboxClaimSpecSchema.safeParse({
      sandboxTemplateRef: {},
    });
    expect(result.success).toBe(false);
  });

  it('accepts sandboxTemplateRef with namespace', () => {
    const result = sandboxClaimSpecSchema.safeParse({
      sandboxTemplateRef: { name: 'tpl', namespace: 'ns' },
    });
    expect(result.success).toBe(true);
  });
});

describe('sandboxWarmPoolSchema', () => {
  const validPool = {
    apiVersion: 'extensions.agents.x-k8s.io/v1alpha1',
    kind: 'SandboxWarmPool',
    metadata: { name: 'my-pool' },
    spec: {
      replicas: 3,
      sandboxTemplateRef: { name: 'base' },
    },
  };

  it('accepts a valid warm pool', () => {
    const result = sandboxWarmPoolSchema.safeParse(validPool);
    expect(result.success).toBe(true);
  });

  it('rejects warm pool with wrong kind', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      kind: 'Sandbox',
    });
    expect(result.success).toBe(false);
  });

  it('rejects warm pool with negative replicas', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      spec: { ...validPool.spec, replicas: -1 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts warm pool with zero replicas', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      spec: { ...validPool.spec, replicas: 0 },
    });
    expect(result.success).toBe(true);
  });

  it('rejects warm pool with non-integer replicas', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      spec: { ...validPool.spec, replicas: 1.5 },
    });
    expect(result.success).toBe(false);
  });

  it('accepts warm pool with autoscaling', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      spec: {
        ...validPool.spec,
        minReplicas: 1,
        maxReplicas: 10,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts warm pool with status', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      status: {
        readyReplicas: 3,
        allocatedReplicas: 1,
        replicas: 4,
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts warm pool with labels', () => {
    const result = sandboxWarmPoolSchema.safeParse({
      ...validPool,
      metadata: { ...validPool.metadata, labels: { tier: 'warm' } },
    });
    expect(result.success).toBe(true);
  });
});

describe('sandboxWarmPoolSpecSchema', () => {
  it('requires replicas', () => {
    const result = sandboxWarmPoolSpecSchema.safeParse({
      sandboxTemplateRef: { name: 'base' },
    });
    expect(result.success).toBe(false);
  });

  it('requires sandboxTemplateRef', () => {
    const result = sandboxWarmPoolSpecSchema.safeParse({
      replicas: 3,
    });
    expect(result.success).toBe(false);
  });

  it('requires sandboxTemplateRef.name', () => {
    const result = sandboxWarmPoolSpecSchema.safeParse({
      replicas: 3,
      sandboxTemplateRef: {},
    });
    expect(result.success).toBe(false);
  });
});
