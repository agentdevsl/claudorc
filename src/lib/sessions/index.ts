/**
 * Session Management Module
 *
 * Exports all session-related functionality including:
 * - Event schemas and types
 * - TanStack DB collections
 * - Stream-to-collection sync
 * - Derived data utilities
 *
 * @module lib/sessions
 */

// Collections
export {
  agentStateCollection,
  chunksCollection,
  clearSessionCollections,
  getCollectionStats,
  messagesCollection,
  presenceCollection,
  sessionCollections,
  terminalCollection,
  toolCallsCollection,
  workflowCollection,
} from './collections.js';
// Derived utilities
export {
  getActivePresence,
  getPendingToolCalls,
  getSessionAgentState,
  getSessionAgentStates,
  getSessionChunks,
  getSessionFullText,
  getSessionMessages,
  getSessionStats,
  getSessionTerminal,
  getSessionToolCalls,
  getTerminalInputHistory,
  hasSessionActivity,
  type SessionStats,
} from './derived.js';
// Session data hooks
export {
  type UseSessionDataResult,
  usePendingToolCalls,
  useSessionAgentState,
  useSessionChunks,
  useSessionData,
  useSessionFullText,
  useSessionMessages,
  useSessionPresence,
  useSessionTerminal,
  useSessionToolCalls,
} from './hooks/use-session-data.js';
// Optimistic writes
export {
  type OptimisticWriteOptions,
  sendPresenceJoin,
  sendPresenceLeave,
  sendPresenceUpdate,
  sendTerminalInput,
} from './optimistic.js';

// Router
export {
  type ChannelHandler,
  createSessionRouter,
  SessionEventRouter,
} from './router.js';
// Schemas and types
export {
  type AgentStateEvent,
  agentStateSchema,
  type ChunkEvent,
  chunkSchema,
  type Message,
  messageSchema,
  type PresenceEvent,
  presenceSchema,
  type SessionEvent,
  type TerminalEvent,
  type ToolCallEvent,
  terminalSchema,
  toolCallSchema,
  type WorkflowEvent,
  workflowSchema,
} from './schema.js';
// Sync
export {
  getActiveSyncCount,
  insertWorkflowEvent,
  isSessionSyncing,
  stopAllSyncs,
  stopSessionSync,
  syncSessionToCollections,
} from './sync.js';
