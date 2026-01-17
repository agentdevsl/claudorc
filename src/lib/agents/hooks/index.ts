import type { SessionEvent } from '../../../services/session.service.js';
import type { Database } from '../../../types/database.js';
import type { AgentHooks } from '../types.js';
import { createAuditHook } from './audit.js';
import { createStreamingHooks } from './streaming.js';
import { createToolWhitelistHook } from './tool-whitelist.js';

export interface CreateAgentHooksInput {
  agentId: string;
  sessionId: string;
  agentRunId: string;
  taskId: string | null;
  projectId: string;
  allowedTools: string[];
  db: Database;
  sessionService: {
    publish: (sessionId: string, event: SessionEvent) => Promise<unknown>;
  };
}

export function createAgentHooks(input: CreateAgentHooksInput): AgentHooks {
  const { agentId, sessionId, agentRunId, taskId, projectId, allowedTools, db, sessionService } =
    input;

  const streamingHooks = createStreamingHooks(agentId, sessionId, sessionService);
  const whitelistHook = createToolWhitelistHook(allowedTools);
  const auditHook = createAuditHook(db, agentId, agentRunId, taskId, projectId);

  return {
    PreToolUse: [whitelistHook, streamingHooks.PreToolUse],
    PostToolUse: [auditHook, streamingHooks.PostToolUse],
  };
}

export { createAuditHook } from './audit.js';
export { createStreamingHooks } from './streaming.js';
export { createToolWhitelistHook } from './tool-whitelist.js';
