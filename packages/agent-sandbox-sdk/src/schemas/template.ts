import { z } from 'zod';
import { sandboxNetworkRuleSchema, sandboxVolumeClaimSchema } from './sandbox.js';

export const sandboxTemplateSpecSchema = z.object({
  podTemplate: z.any(),
  networkPolicy: z
    .object({
      egress: z.array(sandboxNetworkRuleSchema).optional(),
      ingress: z.array(sandboxNetworkRuleSchema).optional(),
    })
    .optional(),
  runtimeClassName: z.string().optional(),
  volumeClaims: z.array(sandboxVolumeClaimSchema).optional(),
});

export const sandboxTemplateStatusSchema = z.object({
  sandboxCount: z.number().optional(),
});

export const sandboxTemplateSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('SandboxTemplate'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: sandboxTemplateSpecSchema,
  status: sandboxTemplateStatusSchema.optional(),
});
