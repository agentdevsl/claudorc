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
  sandboxConfigId: cuidSchema.optional(),
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

// Template schemas
const templateScopeSchema = z.enum(['org', 'project']);

export const listTemplatesSchema = z.object({
  scope: templateScopeSchema.optional(),
  projectId: cuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
});

// GitHub URL validation - accepts full URLs or owner/repo format
const githubUrlSchema = z.string().refine(
  (val) => {
    // Accept owner/repo format
    if (/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(val)) return true;
    // Accept full GitHub URLs
    if (/github\.com[/:][a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+/.test(val)) return true;
    return false;
  },
  { message: 'Must be a GitHub repository URL or owner/repo format' }
);

export const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  scope: templateScopeSchema,
  githubUrl: githubUrlSchema,
  branch: z.string().max(100).optional(),
  configPath: z.string().max(500).optional(),
  /** @deprecated Use projectIds instead */
  projectId: cuidSchema.optional(),
  /** Project IDs to associate with this template (for project-scoped templates) */
  projectIds: z.array(cuidSchema).optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  branch: z.string().max(100).optional(),
  configPath: z.string().max(500).optional(),
  /** Update the project associations (replaces existing) */
  projectIds: z.array(cuidSchema).optional(),
});

// Sandbox Config schemas
export const sandboxTypeSchema = z.enum(['docker', 'devcontainer']);

export const listSandboxConfigsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const createSandboxConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  type: sandboxTypeSchema.optional().default('docker'),
  isDefault: z.boolean().optional().default(false),
  baseImage: z.string().min(1).max(200).optional().default('node:22-slim'),
  memoryMb: z.coerce.number().min(512).max(32768).optional().default(4096),
  cpuCores: z.coerce.number().min(0.5).max(16).optional().default(2.0),
  maxProcesses: z.coerce.number().min(32).max(4096).optional().default(256),
  timeoutMinutes: z.coerce.number().min(1).max(1440).optional().default(60),
  /** Volume mount path from local host for docker sandboxes */
  volumeMountPath: z.string().max(500).optional(),
});

export const updateSandboxConfigSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  type: sandboxTypeSchema.optional(),
  isDefault: z.boolean().optional(),
  baseImage: z.string().min(1).max(200).optional(),
  memoryMb: z.coerce.number().min(512).max(32768).optional(),
  cpuCores: z.coerce.number().min(0.5).max(16).optional(),
  maxProcesses: z.coerce.number().min(32).max(4096).optional(),
  timeoutMinutes: z.coerce.number().min(1).max(1440).optional(),
  /** Volume mount path from local host for docker sandboxes */
  volumeMountPath: z.string().max(500).optional(),
});
