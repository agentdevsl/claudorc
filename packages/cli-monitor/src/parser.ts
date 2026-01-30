import path from 'node:path';
import type { SessionStore } from './session-store.js';

// Minimal types for JSONL events (no dependency on main repo types)
interface RawEvent {
  type: string;
  uuid: string;
  timestamp: string;
  sessionId: string;
  cwd: string;
  version?: string;
  gitBranch?: string;
  parentUuid: string | null;
  isSidechain?: boolean;
  agentId?: string;
  message?: {
    role: 'user' | 'assistant';
    model?: string;
    content: string | ContentBlock[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
      cache_creation_input_tokens: number;
      cache_read_input_tokens: number;
    };
    stop_reason?: string | null;
  };
  summary?: string;
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

type SessionStatus = 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';

export function parseJsonlFile(
  filePath: string,
  newContent: string,
  _startOffset: number,
  store: SessionStore
): number {
  const lines = newContent.split('\n');
  let bytesConsumed = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] as string;
    // Last element from split has no trailing \n
    const isLast = i === lines.length - 1;
    const lineBytes = Buffer.byteLength(isLast ? line : `${line}\n`, 'utf-8');
    const trimmed = line.trim();
    if (!trimmed) {
      bytesConsumed += lineBytes;
      continue;
    }

    let event: RawEvent;
    try {
      event = JSON.parse(trimmed);
    } catch {
      // Partial line — preserve for next read
      break;
    }

    if (!event.sessionId || !event.type) continue;

    const sessionId = event.sessionId;
    const isSubagent = filePath.includes('/subagents/') || !!event.agentId;

    // Get or create session
    let session = store.getSession(sessionId);
    if (!session) {
      // Extract project info from file path
      // Path format: ~/.claude/projects/{hash}/{sessionId}.jsonl
      const parts = filePath.split(path.sep);
      const projectHash = parts[parts.length - 2] || '';

      session = {
        sessionId,
        filePath,
        cwd: event.cwd || '',
        projectName: event.cwd ? path.basename(event.cwd) : '',
        projectHash,
        gitBranch: event.gitBranch,
        status: 'working' as SessionStatus,
        messageCount: 0,
        turnCount: 0,
        tokenUsage: {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
        },
        startedAt: Date.parse(event.timestamp) || Date.now(),
        lastActivityAt: Date.parse(event.timestamp) || Date.now(),
        lastReadOffset: 0,
        isSubagent,
        parentSessionId: isSubagent ? extractParentSessionId(filePath) : undefined,
      };
    }

    // Update timestamp
    const eventTime = Date.parse(event.timestamp);
    if (eventTime) {
      session.lastActivityAt = eventTime;
    }

    // Update git branch if present
    if (event.gitBranch) {
      session.gitBranch = event.gitBranch;
    }

    // Process based on event type
    const message = event.message;
    if (message) {
      if (message.role === 'user') {
        session.messageCount++;

        // Set goal from first user text message
        if (!session.goal && typeof message.content === 'string') {
          session.goal = message.content.slice(0, 200);
        }

        // Check for tool_result in content (approval was given)
        if (Array.isArray(message.content)) {
          const hasToolResult = message.content.some((b) => b.type === 'tool_result');
          if (hasToolResult) {
            session.status = 'working';
            session.pendingToolUse = undefined;
          }
        }
      }

      if (message.role === 'assistant') {
        session.messageCount++;

        // Set model
        if (message.model) {
          session.model = message.model;
        }

        // Accumulate tokens
        if (message.usage) {
          session.tokenUsage.inputTokens += message.usage.input_tokens || 0;
          session.tokenUsage.outputTokens += message.usage.output_tokens || 0;
          session.tokenUsage.cacheCreationTokens += message.usage.cache_creation_input_tokens || 0;
          session.tokenUsage.cacheReadTokens += message.usage.cache_read_input_tokens || 0;
        }

        if (Array.isArray(message.content)) {
          let hasToolUse = false;
          let hasText = false;

          for (const block of message.content) {
            if (block.type === 'tool_use' && block.name && block.id) {
              hasToolUse = true;
              session.pendingToolUse = { toolName: block.name, toolId: block.id };
            }
            if (block.type === 'text' && block.text) {
              hasText = true;
              session.recentOutput = block.text.slice(0, 500);
            }
          }

          // tool_use takes precedence over text for status
          if (hasToolUse) {
            session.status = 'waiting_for_approval';
          } else if (hasText) {
            session.status = 'working';
          }
        } else if (typeof message.content === 'string') {
          session.recentOutput = message.content.slice(0, 500);
          session.status = 'working';
        }

        // Turn complete when stop_reason is set
        if (message.stop_reason != null) {
          session.turnCount++;
          // Don't override waiting_for_approval — tool use takes priority
          if (session.status !== 'waiting_for_approval') {
            session.status = 'waiting_for_input';
          }
        }
      }
    }

    // Summary event = session ending
    if (event.type === 'summary') {
      session.status = 'idle';
    }

    store.setSession(sessionId, session);
    bytesConsumed += lineBytes;
  }

  return bytesConsumed;
}

function extractParentSessionId(filePath: string): string | undefined {
  // Path: .../sessions/{parentSessionId}/subagents/{subagentId}.jsonl
  const parts = filePath.split(path.sep);
  const subagentsIdx = parts.indexOf('subagents');
  if (subagentsIdx > 0) {
    return parts[subagentsIdx - 1];
  }
  return undefined;
}
