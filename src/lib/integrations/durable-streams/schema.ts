import { createStateSchema } from '@durable-streams/state';
import { z } from 'zod';

const chunkSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  sessionId: z.string(),
  text: z.string(),
  accumulated: z.string().optional(),
  turn: z.number().optional(),
  timestamp: z.number(),
});

const toolCallSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  sessionId: z.string(),
  tool: z.string(),
  input: z.unknown(),
  output: z.unknown().optional(),
  status: z.enum(['pending', 'running', 'complete', 'error']),
  duration: z.number().optional(),
  timestamp: z.number(),
});

const presenceSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  cursor: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
  lastSeen: z.number(),
  joinedAt: z.number(),
});

const terminalSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  type: z.enum(['input', 'output', 'error']),
  data: z.string(),
  source: z.enum(['user', 'agent', 'system']),
  timestamp: z.number(),
});

const workflowSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  taskId: z.string().optional(),
  type: z.enum([
    'approval:requested',
    'approval:approved',
    'approval:rejected',
    'worktree:created',
    'worktree:merged',
    'worktree:removed',
  ]),
  payload: z.record(z.string(), z.unknown()),
  actor: z.string().optional(),
  timestamp: z.number(),
});

const agentStateSchema = z.object({
  agentId: z.string(),
  sessionId: z.string(),
  status: z.enum(['idle', 'starting', 'running', 'paused', 'error', 'completed']),
  taskId: z.string().optional(),
  turn: z.number().optional(),
  progress: z.number().optional(),
  currentTool: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  timestamp: z.number(),
});

export const sessionSchema = createStateSchema({
  chunks: { schema: chunkSchema, type: 'chunk', primaryKey: 'id' },
  toolCalls: { schema: toolCallSchema, type: 'tool', primaryKey: 'id' },
  presence: { schema: presenceSchema, type: 'presence', primaryKey: 'userId' },
  terminal: { schema: terminalSchema, type: 'terminal', primaryKey: 'id' },
  workflow: { schema: workflowSchema, type: 'workflow', primaryKey: 'id' },
  agentState: { schema: agentStateSchema, type: 'state', primaryKey: 'agentId' },
});

export type ChunkEvent = z.infer<typeof chunkSchema>;
export type ToolCallEvent = z.infer<typeof toolCallSchema>;
export type PresenceEvent = z.infer<typeof presenceSchema>;
export type TerminalEvent = z.infer<typeof terminalSchema>;
export type WorkflowEvent = z.infer<typeof workflowSchema>;
export type AgentStateEvent = z.infer<typeof agentStateSchema>;

export type SessionEvent =
  | { channel: 'chunks'; data: ChunkEvent }
  | { channel: 'toolCalls'; data: ToolCallEvent }
  | { channel: 'presence'; data: PresenceEvent }
  | { channel: 'terminal'; data: TerminalEvent }
  | { channel: 'workflow'; data: WorkflowEvent }
  | { channel: 'agentState'; data: AgentStateEvent };
