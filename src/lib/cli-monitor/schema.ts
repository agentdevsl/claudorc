/**
 * Schema for CLI monitor session collection
 */

import { z } from 'zod';

/**
 * CLI session schema - source of truth for the TanStack DB collection
 */
export const cliSessionSchema = z.object({
  sessionId: z.string(),
  filePath: z.string(),
  cwd: z.string(),
  projectName: z.string(),
  projectHash: z.string(),
  gitBranch: z.string().optional(),
  status: z.enum(['working', 'waiting_for_approval', 'waiting_for_input', 'idle']),
  messageCount: z.number(),
  turnCount: z.number(),
  goal: z.string().optional(),
  recentOutput: z.string().optional(),
  pendingToolUse: z.object({ toolName: z.string(), toolId: z.string() }).optional(),
  tokenUsage: z.object({
    inputTokens: z.number(),
    outputTokens: z.number(),
    cacheCreationTokens: z.number(),
    cacheReadTokens: z.number(),
    ephemeral5mTokens: z.number().optional(),
    ephemeral1hTokens: z.number().optional(),
  }),
  model: z.string().optional(),
  startedAt: z.number(),
  lastActivityAt: z.number(),
  lastReadOffset: z.number(),
  isSubagent: z.boolean(),
  parentSessionId: z.string().optional(),
});

export type CliSession = z.infer<typeof cliSessionSchema>;
