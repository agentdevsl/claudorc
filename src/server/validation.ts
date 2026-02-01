/**
 * Shared Zod validation schemas for API routes.
 *
 * Centralizes validation logic used by multiple route handlers.
 */

import { z } from 'zod';

/** Safe CUID2 / kebab-case identifier */
export const idSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9_-]+$/);

/** Task column enum */
export const taskColumnSchema = z.enum([
  'backlog',
  'queued',
  'in_progress',
  'waiting_approval',
  'verified',
]);

/** Task priority enum */
export const taskPrioritySchema = z.enum(['high', 'medium', 'low']);

// ─── Task Schemas ────────────────────────────────────

export const createTaskSchema = z.object({
  projectId: idSchema,
  title: z.string().min(1, 'Title is required').max(500),
  description: z.string().max(10000).optional(),
  labels: z.array(z.string().max(50)).max(20).optional(),
  priority: taskPrioritySchema.optional(),
});

export const updateTaskSchema = z
  .object({
    title: z.string().min(1).max(500).optional(),
    description: z.string().max(10000).optional(),
    labels: z.array(z.string().max(50)).max(20).optional(),
    priority: taskPrioritySchema.optional(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });

export const moveTaskSchema = z.object({
  column: taskColumnSchema,
  position: z.number().int().min(0).optional(),
  startAgent: z.boolean().optional(),
});

// ─── Agent Schemas ───────────────────────────────────

export const agentTypeSchema = z.enum(['task', 'timer', 'workflow']);

export const createAgentSchema = z.object({
  projectId: idSchema,
  name: z.string().min(1, 'Name is required').max(200),
  type: agentTypeSchema,
  config: z.record(z.string(), z.unknown()).optional(),
});

// ─── Session Schemas ─────────────────────────────────

export const createSessionSchema = z.object({
  projectId: idSchema,
  taskId: idSchema.optional(),
  agentId: idSchema.optional(),
  title: z.string().max(500).optional(),
});

export const exportSessionSchema = z.object({
  format: z.enum(['json', 'markdown', 'csv']),
});

// ─── Worktree Schemas ────────────────────────────────

export const createWorktreeSchema = z.object({
  projectId: idSchema,
  agentId: idSchema,
  taskId: idSchema,
  taskTitle: z.string().min(1).max(500),
  baseBranch: z.string().max(250).optional(),
});

export const mergeWorktreeSchema = z.object({
  targetBranch: z.string().max(250).optional(),
  deleteAfterMerge: z.boolean().optional(),
  squash: z.boolean().optional(),
  commitMessage: z.string().max(1000).optional(),
});

export const commitWorktreeSchema = z.object({
  message: z.string().min(1, 'Commit message is required').max(2000),
});

// ─── Helper ──────────────────────────────────────────

/**
 * Parse a Zod schema and return a validation error response or the parsed data.
 *
 * @returns `{ ok: true, data }` or `{ ok: false, response }` where `response` is
 * a JSON Response ready to return from the handler.
 */
export function parseBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { ok: true; data: T } | { ok: false; response: Response } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? 'Invalid request body';
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          ok: false,
          error: { code: 'VALIDATION_ERROR', message },
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      ),
    };
  }
  return { ok: true, data: result.data };
}
