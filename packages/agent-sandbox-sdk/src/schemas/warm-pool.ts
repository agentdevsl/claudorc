import { z } from 'zod';

export const sandboxWarmPoolSpecSchema = z.object({
  desiredReady: z.number().int().min(0),
  templateRef: z.object({
    name: z.string(),
    namespace: z.string().optional(),
  }),
  maxSize: z.number().int().min(0).optional(),
});

export const sandboxWarmPoolStatusSchema = z.object({
  readyReplicas: z.number().optional(),
  availableReplicas: z.number().optional(),
  conditions: z.array(z.any()).optional(),
});

export const sandboxWarmPoolSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('SandboxWarmPool'),
  metadata: z.object({
    name: z.string(),
    namespace: z.string().optional(),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
  }),
  spec: sandboxWarmPoolSpecSchema,
  status: sandboxWarmPoolStatusSchema.optional(),
});
