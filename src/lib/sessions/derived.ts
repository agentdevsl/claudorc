/**
 * Derived Session Data
 *
 * Utilities for computing derived data from session collections.
 *
 * @module lib/sessions/derived
 */

import {
  agentStateCollection,
  chunksCollection,
  messagesCollection,
  presenceCollection,
  terminalCollection,
  toolCallsCollection,
} from './collections.js';
import type {
  AgentStateEvent,
  ChunkEvent,
  Message,
  PresenceEvent,
  TerminalEvent,
  ToolCallEvent,
} from './schema.js';

/**
 * Get all chunks for a session, sorted by timestamp
 */
export function getSessionChunks(sessionId: string): ChunkEvent[] {
  return chunksCollection.toArray
    .filter((chunk) => chunk.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get all tool calls for a session, sorted by timestamp
 */
export function getSessionToolCalls(sessionId: string): ToolCallEvent[] {
  return toolCallsCollection.toArray
    .filter((tool) => tool.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get pending tool calls for a session
 */
export function getPendingToolCalls(sessionId: string): ToolCallEvent[] {
  return getSessionToolCalls(sessionId).filter(
    (tool) => tool.status === 'pending' || tool.status === 'running'
  );
}

/**
 * Get active presence for a session (users seen in last 30 seconds)
 */
export function getActivePresence(sessionId: string, maxAgeMs = 30000): PresenceEvent[] {
  const cutoff = Date.now() - maxAgeMs;
  return presenceCollection.toArray
    .filter((p) => p.sessionId === sessionId && p.lastSeen > cutoff)
    .sort((a, b) => b.lastSeen - a.lastSeen);
}

/**
 * Get all terminal events for a session, sorted by timestamp
 */
export function getSessionTerminal(sessionId: string): TerminalEvent[] {
  return terminalCollection.toArray
    .filter((t) => t.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get terminal input history for a session (for command completion)
 */
export function getTerminalInputHistory(sessionId: string, limit = 50): string[] {
  return getSessionTerminal(sessionId)
    .filter((t) => t.type === 'input')
    .map((t) => t.data)
    .reverse()
    .slice(0, limit);
}

/**
 * Get the current agent state for a session
 */
export function getSessionAgentState(
  sessionId: string,
  agentId?: string
): AgentStateEvent | undefined {
  if (agentId) {
    const key = `${sessionId}:${agentId}` as `${string}:${string}`;
    return agentStateCollection.get(key);
  }

  // If no specific agent, find first agent for this session
  const states = agentStateCollection.toArray.filter((s) => s.sessionId === sessionId);
  return states.length > 0 ? states[0] : undefined;
}

/**
 * Get all agent states for a session
 */
export function getSessionAgentStates(sessionId: string): AgentStateEvent[] {
  return agentStateCollection.toArray.filter((s) => s.sessionId === sessionId);
}

/**
 * Get derived messages for a session, sorted by turn then timestamp
 */
export function getSessionMessages(sessionId: string): Message[] {
  return messagesCollection.toArray
    .filter((m) => m.sessionId === sessionId)
    .sort((a, b) => {
      if (a.turn !== b.turn) return a.turn - b.turn;
      return a.timestamp - b.timestamp;
    });
}

/**
 * Get the full accumulated text for a session from chunks
 */
export function getSessionFullText(sessionId: string): string {
  return getSessionChunks(sessionId)
    .map((chunk) => chunk.text)
    .join('');
}

/**
 * Get session statistics
 */
export interface SessionStats {
  chunkCount: number;
  toolCallCount: number;
  completedToolCalls: number;
  pendingToolCalls: number;
  terminalLineCount: number;
  activeParticipants: number;
  messageCount: number;
  agentStatus: AgentStateEvent['status'] | null;
}

export function getSessionStats(sessionId: string): SessionStats {
  const toolCalls = getSessionToolCalls(sessionId);

  return {
    chunkCount: chunksCollection.toArray.filter((c) => c.sessionId === sessionId).length,
    toolCallCount: toolCalls.length,
    completedToolCalls: toolCalls.filter((t) => t.status === 'complete').length,
    pendingToolCalls: toolCalls.filter((t) => t.status === 'pending' || t.status === 'running')
      .length,
    terminalLineCount: terminalCollection.toArray.filter((t) => t.sessionId === sessionId).length,
    activeParticipants: getActivePresence(sessionId).length,
    messageCount: messagesCollection.toArray.filter((m) => m.sessionId === sessionId).length,
    agentStatus: getSessionAgentState(sessionId)?.status ?? null,
  };
}

/**
 * Check if a session has any activity
 */
export function hasSessionActivity(sessionId: string): boolean {
  const stats = getSessionStats(sessionId);
  return (
    stats.chunkCount > 0 ||
    stats.toolCallCount > 0 ||
    stats.terminalLineCount > 0 ||
    stats.messageCount > 0
  );
}
