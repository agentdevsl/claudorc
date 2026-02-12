import { z } from 'zod';

export const sandboxNetworkRuleSchema = z.object({
  ports: z
    .array(
      z.object({
        port: z.number(),
        protocol: z.string(),
      })
    )
    .optional(),
  to: z
    .array(
      z.object({
        ipBlock: z
          .object({
            cidr: z.string(),
            except: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .optional(),
  from: z
    .array(
      z.object({
        ipBlock: z
          .object({
            cidr: z.string(),
            except: z.array(z.string()).optional(),
          })
          .optional(),
      })
    )
    .optional(),
});

export const sandboxVolumeClaimSchema = z.object({
  name: z.string(),
  storageClassName: z.string().optional(),
  accessModes: z.array(z.string()),
  resources: z.object({
    requests: z.object({
      storage: z.string(),
    }),
  }),
});

export const sandboxSpecSchema = z.object({
  sandboxTemplateRef: z
    .object({
      name: z.string(),
      namespace: z.string().optional(),
    })
    .optional(),
  podTemplate: z.any().optional(),
  replicas: z.number().int().min(0).max(1).optional(),
  networkPolicy: z
    .object({
      egress: z.array(sandboxNetworkRuleSchema).optional(),
      ingress: z.array(sandboxNetworkRuleSchema).optional(),
    })
    .optional(),
  volumeClaims: z.array(sandboxVolumeClaimSchema).optional(),
  runtimeClassName: z.string().optional(),
  ttlSecondsAfterFinished: z.number().int().positive().optional(),
});

export const sandboxStatusSchema = z.object({
  phase: z.enum(['Pending', 'Running', 'Paused', 'Succeeded', 'Failed', 'Unknown']).optional(),
  conditions: z.array(z.any()).optional(),
  podName: z.string().optional(),
  serviceFQDN: z.string().optional(),
  podIP: z.string().optional(),
  readyReplicas: z.number().optional(),
  readyAt: z.string().optional(),
});

export const sandboxSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Sandbox'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: sandboxSpecSchema,
  status: sandboxStatusSchema.optional(),
});
