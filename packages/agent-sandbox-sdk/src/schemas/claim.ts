import { z } from 'zod';

export const sandboxClaimSpecSchema = z.object({
  sandboxTemplateRef: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  warmPoolRef: z
    .object({
      name: z.string(),
      namespace: z.string().optional(),
    })
    .optional(),
});

export const sandboxClaimStatusSchema = z.object({
  phase: z.enum(['Pending', 'Bound', 'Failed']).optional(),
  sandboxRef: z
    .object({
      name: z.string(),
      namespace: z.string().optional(),
    })
    .optional(),
  conditions: z.array(z.any()).optional(),
  boundAt: z.string().optional(),
});

export const sandboxClaimSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('SandboxClaim'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: sandboxClaimSpecSchema,
  status: sandboxClaimStatusSchema.optional(),
});
