import { isCuid } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { projectConfigSchema } from '../config/schemas.js';

const cuidSchema = z.string().refine(isCuid, { message: 'Invalid ID format' });
const taskColumnSchema = z.enum(['backlog', 'in_progress', 'waiting_approval', 'verified']);
const agentStatusSchema = z.enum(['idle', 'starting', 'running', 'paused', 'error', 'completed']);
const agentTypeSchema = z.enum(['task', 'conversational', 'background']);

export const listProjectsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  search: z.string().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  path: z.string().min(1),
  description: z.string().max(500).optional(),
  config: projectConfigSchema.optional(),
  maxConcurrentAgents: z.number().min(1).max(10).optional(),
  githubOwner: z.string().optional(),
  githubRepo: z.string().optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  config: projectConfigSchema.partial().optional(),
  maxConcurrentAgents: z.number().min(1).max(10).optional(),
});

export const listTasksSchema = z.object({
  projectId: cuidSchema,
  column: taskColumnSchema.optional(),
  agentId: cuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

export const createTaskSchema = z.object({
  projectId: cuidSchema,
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  labels: z.array(z.string()).max(10).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  labels: z.array(z.string()).max(10).optional(),
});

export const moveTaskSchema = z.object({
  column: taskColumnSchema,
  position: z.coerce.number().min(0).optional(),
});

export const approveTaskSchema = z.object({
  approvedBy: z.string().optional(),
  createMergeCommit: z.boolean().optional(),
});

export const rejectTaskSchema = z.object({
  reason: z.string().min(1).max(1000),
});

export const listAgentsSchema = z.object({
  projectId: cuidSchema,
  status: agentStatusSchema.optional(),
  type: agentTypeSchema.optional(),
});

const agentConfigSchema = z.object({
  allowedTools: z.array(z.string()).optional(),
  maxTurns: z.number().min(1).max(500).optional(),
  model: z.string().optional(),
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(1).optional(),
});

export const createAgentSchema = z.object({
  projectId: cuidSchema,
  name: z.string().min(1).max(100),
  type: agentTypeSchema.default('task'),
  config: agentConfigSchema.optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  config: agentConfigSchema.partial().optional(),
});

export const startAgentSchema = z.object({
  taskId: cuidSchema.optional(),
});

export const createSessionSchema = z.object({
  projectId: cuidSchema,
  taskId: cuidSchema.optional(),
  agentId: cuidSchema.optional(),
  title: z.string().max(200).optional(),
});

export const updatePresenceSchema = z.object({
  userId: z.string().min(1),
  cursor: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  activeFile: z.string().optional(),
});

// Worktree schemas
export const listWorktreesSchema = z.object({
  projectId: cuidSchema,
});

export const createWorktreeSchema = z.object({
  projectId: cuidSchema,
  taskId: cuidSchema,
  baseBranch: z.string().optional(),
});

export const commitWorktreeSchema = z.object({
  message: z.string().min(1).max(500),
});

export const mergeWorktreeSchema = z.object({
  targetBranch: z.string().optional(),
});

export const pruneWorktreesSchema = z.object({
  projectId: cuidSchema,
});

// Agent lifecycle schemas
export const pauseAgentSchema = z.object({});

export const resumeAgentSchema = z.object({
  feedback: z.string().max(5000).optional(),
});

// GitHub webhook schema
export const githubWebhookSchema = z.object({
  action: z.string(),
  installation: z
    .object({
      id: z.number(),
      account: z.object({
        login: z.string(),
        type: z.string(),
      }),
    })
    .optional(),
  repository: z
    .object({
      owner: z.object({ login: z.string() }),
      name: z.string(),
    })
    .optional(),
});
