import path from 'node:path';
import { logger } from './logger.js';
import type { CompactionEvent, SessionStatus, SessionStore } from './session-store.js';

// Minimal types for JSONL events (no dependency on main repo types)
interface RawEvent {
  type: string;
  subtype?: string;
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
      cache_creation?: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
      };
    };
    stop_reason?: string | null;
  };
  // progress events nest message under data
  data?: {
    message?: RawEvent['message'];
  };
  summary?: string;
  compactMetadata?: {
    trigger: string;
    preTokens: number;
  };
  microcompactMetadata?: {
    trigger: string;
    preTokens: number;
    tokensSaved?: number;
    compactedToolIds?: string[];
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  thinking?: string;
  signature?: string;
  id?: string;
  name?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

const MAX_LINE_BYTES = 1_000_000; // 1MB per line
const MAX_RECENT_TURNS = 10;
const MAX_GOAL_LENGTH = 200;
const MAX_RECENT_OUTPUT_LENGTH = 500;
const CONTEXT_WINDOW_DEFAULT = 200_000;

function getContextWindowLimit(model?: string): number {
  // All current Claude models use 200k context window
  if (model && (model.includes('sonnet') || model.includes('opus') || model.includes('haiku'))) {
    return 200_000;
  }
  return CONTEXT_WINDOW_DEFAULT;
}

function deriveHealthStatus(
  pressure: number,
  cacheHitRatio: number,
  turnCount: number,
  compactionCount: number
): 'healthy' | 'warning' | 'critical' {
  if (pressure > 0.9 || (cacheHitRatio < 0.1 && turnCount > 3)) return 'critical';
  if (pressure > 0.7 || (cacheHitRatio < 0.3 && turnCount > 3) || compactionCount > 0)
    return 'warning';
  return 'healthy';
}

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

    if (lineBytes > MAX_LINE_BYTES) {
      logger.warn('Skipping oversized line', { bytes: lineBytes, filePath });
      bytesConsumed += lineBytes;
      continue;
    }

    const trimmed = line.trim();
    if (!trimmed) {
      bytesConsumed += lineBytes;
      continue;
    }

    let event: RawEvent;
    try {
      event = JSON.parse(trimmed);
    } catch {
      // If this is the last line it's likely a partial/incomplete line — preserve for next read.
      // If it's a middle line, log and skip it (corrupted data).
      if (isLast) break;
      logger.warn('Skipping malformed JSON line', { filePath, lineIndex: i });
      bytesConsumed += lineBytes;
      continue;
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
          ephemeral5mTokens: 0,
          ephemeral1hTokens: 0,
        },
        startedAt: Date.parse(event.timestamp) || Date.now(),
        lastActivityAt: Date.parse(event.timestamp) || Date.now(),
        lastReadOffset: 0,
        isSubagent,
        parentSessionId: isSubagent ? extractParentSessionId(filePath) : undefined,
        performanceMetrics: {
          compactionCount: 0,
          lastCompactionAt: null,
          compactionEvents: [],
          recentTurns: [],
          cacheHitRatio: 0,
          contextWindowUsed: 0,
          contextWindowLimit: CONTEXT_WINDOW_DEFAULT,
          contextPressure: 0,
          healthStatus: 'healthy',
        },
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
          session.goal = message.content.slice(0, MAX_GOAL_LENGTH);
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
          if (message.usage.cache_creation) {
            session.tokenUsage.ephemeral5mTokens =
              (session.tokenUsage.ephemeral5mTokens || 0) +
              (message.usage.cache_creation.ephemeral_5m_input_tokens || 0);
            session.tokenUsage.ephemeral1hTokens =
              (session.tokenUsage.ephemeral1hTokens || 0) +
              (message.usage.cache_creation.ephemeral_1h_input_tokens || 0);
          }
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
              session.recentOutput = block.text.slice(0, MAX_RECENT_OUTPUT_LENGTH);
            }
          }

          // tool_use takes precedence over text for status
          if (hasToolUse) {
            session.status = 'waiting_for_approval';
          } else if (hasText) {
            session.status = 'working';
          }
        } else if (typeof message.content === 'string') {
          session.recentOutput = message.content.slice(0, MAX_RECENT_OUTPUT_LENGTH);
          session.status = 'working';
        }

        // Turn complete when stop_reason is set
        if (message.stop_reason != null) {
          session.turnCount++;
          // Don't override waiting_for_approval — tool use takes priority
          if (session.status !== 'waiting_for_approval') {
            session.status = 'waiting_for_input';
          }

          // Track per-turn metrics in ring buffer
          if (session.performanceMetrics && message.usage) {
            const pm = session.performanceMetrics;
            const turnMetric = {
              turnNumber: session.turnCount,
              inputTokens: message.usage.input_tokens || 0,
              outputTokens: message.usage.output_tokens || 0,
              cacheReadTokens: message.usage.cache_read_input_tokens || 0,
              cacheCreationTokens: message.usage.cache_creation_input_tokens || 0,
              timestamp: eventTime || Date.now(),
            };
            pm.recentTurns.push(turnMetric);
            if (pm.recentTurns.length > MAX_RECENT_TURNS) {
              pm.recentTurns.shift();
            }

            // Cache hit ratio across recent turns
            let totalCacheRead = 0;
            let totalInput = 0;
            for (const t of pm.recentTurns) {
              totalCacheRead += t.cacheReadTokens;
              totalInput += t.inputTokens;
            }
            pm.cacheHitRatio =
              totalCacheRead + totalInput > 0 ? totalCacheRead / (totalCacheRead + totalInput) : 0;

            // Context pressure from most recent turn's input tokens
            pm.contextWindowUsed = message.usage.input_tokens || 0;
            pm.contextWindowLimit = getContextWindowLimit(session.model);
            pm.contextPressure = pm.contextWindowUsed / pm.contextWindowLimit;

            // Derive health
            pm.healthStatus = deriveHealthStatus(
              pm.contextPressure,
              pm.cacheHitRatio,
              session.turnCount,
              pm.compactionCount
            );
          }
        }
      }
    }

    // Summary event marks session as completed (idle)
    if (event.type === 'summary') {
      session.status = 'idle';
      session.pendingToolUse = undefined;
      if (event.summary) {
        session.recentOutput = event.summary.slice(0, MAX_RECENT_OUTPUT_LENGTH);
      }
    }

    // Compaction events: system events with compact_boundary or microcompact_boundary subtypes
    if (
      event.type === 'system' &&
      (event.subtype === 'compact_boundary' || event.subtype === 'microcompact_boundary')
    ) {
      if (session.performanceMetrics) {
        const pm = session.performanceMetrics;
        const isMicro = event.subtype === 'microcompact_boundary';
        const metadata = isMicro ? event.microcompactMetadata : event.compactMetadata;

        const compactionEvent: CompactionEvent = {
          type: isMicro ? 'microcompact' : 'compact',
          timestamp: eventTime || Date.now(),
          trigger: metadata?.trigger ?? 'unknown',
          preTokens: metadata?.preTokens ?? 0,
          tokensSaved: isMicro ? event.microcompactMetadata?.tokensSaved : undefined,
          sessionId,
          parentSessionId: session.parentSessionId,
        };

        pm.compactionCount++;
        pm.lastCompactionAt = compactionEvent.timestamp;
        pm.compactionEvents.push(compactionEvent);

        // Re-derive health after compaction
        pm.healthStatus = deriveHealthStatus(
          pm.contextPressure,
          pm.cacheHitRatio,
          session.turnCount,
          pm.compactionCount
        );
      }
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
