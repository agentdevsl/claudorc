/**
 * Tracing module for Langfuse integration.
 *
 * This module provides a type-safe API for creating Langfuse observations
 * using the v4 SDK with asType support for proper observation types.
 *
 * @example
 * ```typescript
 * import {
 *   initTracing,
 *   createConfigFromEnv,
 *   createSessionObservation,
 *   createToolObservation,
 *   shutdownTracing,
 * } from "./tracing/index.js";
 *
 * // Initialize tracing
 * initTracing(createConfigFromEnv());
 *
 * // Create observations with proper types
 * const session = createSessionObservation({ sessionId: "xxx", cwd: "/path" });
 * const agent = createToolObservation({ toolName: "Task", isSubagent: true, ... }, undefined, session);
 * const tool = createToolObservation({ toolName: "Bash", ... }, undefined, session);
 *
 * // Shutdown before exit
 * await shutdownTracing();
 * ```
 */

// Observation factory exports
export {
  type CreateObservationOptions,
  createEventObservation,
  createParentContext,
  createSessionObservation,
  createSessionObservationWithParent,
  createSessionTraceId,
  createToolObservation,
  createToolObservationWithContext,
  // Traceparent helpers for cross-process context propagation
  createTraceparent,
  type FinalizeSessionOptions,
  finalizeSessionObservation,
  finalizeToolObservation,
  // Status message formatting
  formatStatusMessage,
  parseTraceparent,
  recordEvent,
  recordEventWithContext,
  type SessionObservation,
  type ToolObservation,
  type UpsertObservationParams,
  // Cross-process upsert for duplicate prevention
  upsertToolObservation,
  withParentContext,
} from './observations.js';
// Persistence exports for cross-process span linking
export {
  calculateAggregateMetrics,
  cleanupOldStates,
  cleanupPendingParentContexts,
  cleanupProcessedEvents,
  createEmptyMetrics,
  // Event deduplication for cross-process duplicate prevention
  createEventFingerprint,
  deleteSpanState,
  findAndRemovePendingParentContextBySession,
  findPendingParentContext,
  // Extended functions for SubagentStop cleanup
  findPendingParentContextBySession,
  getSessionInfo,
  getSessionMetrics,
  // Tool chain state for cascade failure detection
  getToolChainContext,
  hasProcessedEvent,
  initSession,
  loadSpanState,
  markEventProcessed,
  type PendingParentContext,
  type PersistedSpanState,
  popActiveSpan,
  registerActiveSpan,
  removePendingParentContext,
  resetToolChainState,
  saveSpanState,
  // Pending parent context for subagent linking
  storePendingParentContext,
  type TokenData,
  updateSessionMetrics,
  updateToolChainState,
} from './persistence.js';
// Provider exports
export {
  createConfigFromEnv,
  flushScores,
  forceFlush,
  getLangfuseClient,
  getTracingConfig,
  initTracing,
  isTracingInitialized,
  shutdownTracing,
} from './provider.js';

// Score recording exports for failure tracking
export {
  calculateSessionHealth,
  createScoreIdempotencyKey,
  // Failure categories
  FAILURE_CATEGORIES,
  // Types
  type FailureCategory,
  // Helper functions
  getErrorSeverity,
  type RecordScoreOptions,
  recordCascadeFailureScore,
  recordDominantFailureModeScore,
  recordErrorSeverityScore,
  recordFailureCategoryScore,
  // Score recording functions
  recordScore,
  recordSessionHealthScore,
  recordSessionHealthScores,
  recordSessionSuccessRateScore,
  // Composite recording functions
  recordToolFailureScores,
  recordToolSuccessScore,
  recordToolSuccessScores,
  SCORE_DOMINANT_FAILURE_MODE,
  SCORE_ERROR_SEVERITY,
  SCORE_FAILURE_CATEGORY,
  SCORE_IS_CASCADE_FAILURE,
  SCORE_SESSION_HEALTH,
  SCORE_SESSION_SUCCESS_RATE,
  // Score name constants
  SCORE_TOOL_SUCCESS,
  SESSION_HEALTH_VALUES,
  type SessionHealth,
} from './scores.js';
// Type exports
export type {
  ActiveSpanInfo,
  GitContext,
  ObservationLevel,
  ObservationType,
  SessionContext,
  SessionMetrics,
  SpanState,
  StartObservationOptions,
  TokenUsage,
  ToolChainContext,
  ToolChainState,
  ToolContext,
  ToolResult,
  TracingConfig,
} from './types.js';
