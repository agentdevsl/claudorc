/**
 * Schema for sandbox status collection
 */

import { z } from 'zod';

/**
 * Sandbox status entry schema
 */
export const sandboxStatusSchema = z.object({
  /** Project ID (primary key) */
  projectId: z.string(),
  /** Sandbox mode: shared container or per-project */
  mode: z.enum(['shared', 'per-project']),
  /** Current container status */
  containerStatus: z.enum(['stopped', 'creating', 'running', 'idle', 'error', 'unavailable']),
  /** Docker container ID if available */
  containerId: z.string().nullable(),
  /** Whether Docker is available */
  dockerAvailable: z.boolean(),
  /** Last updated timestamp */
  updatedAt: z.number(),
});

export type SandboxStatus = z.infer<typeof sandboxStatusSchema>;
