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

// Type exports
export type {
  SpanState,
  ActiveSpanInfo,
  GitContext,
  SessionContext,
  ToolContext,
  ToolResult,
  StartObservationOptions,
  TracingConfig,
  ObservationLevel,
  ObservationType,
  SessionMetrics,
  TokenUsage,
  ToolChainContext,
  ToolChainState,
} from './types.js';

// Provider exports
export {
  initTracing,
  shutdownTracing,
  forceFlush,
  flushScores,
  getTracingConfig,
  isTracingInitialized,
  createConfigFromEnv,
  getLangfuseClient,
} from './provider.js';

// Observation factory exports
export {
  createSessionTraceId,
  createParentContext,
  createSessionObservation,
  createSessionObservationWithParent,
  createToolObservation,
  createToolObservationWithContext,
  createEventObservation,
  finalizeToolObservation,
  finalizeSessionObservation,
  recordEvent,
  recordEventWithContext,
  // Cross-process upsert for duplicate prevention
  upsertToolObservation,
  // Traceparent helpers for cross-process context propagation
  createTraceparent,
  parseTraceparent,
  withParentContext,
  // Status message formatting
  formatStatusMessage,
  type SessionObservation,
  type ToolObservation,
  type CreateObservationOptions,
  type FinalizeSessionOptions,
  type UpsertObservationParams,
} from './observations.js';

// Score recording exports for failure tracking
export {
  // Score name constants
  SCORE_TOOL_SUCCESS,
  SCORE_FAILURE_CATEGORY,
  SCORE_ERROR_SEVERITY,
  SCORE_SESSION_SUCCESS_RATE,
  SCORE_SESSION_HEALTH,
  SCORE_DOMINANT_FAILURE_MODE,
  SCORE_IS_CASCADE_FAILURE,
  // Failure categories
  FAILURE_CATEGORIES,
  SESSION_HEALTH_VALUES,
  // Helper functions
  getErrorSeverity,
  createScoreIdempotencyKey,
  calculateSessionHealth,
  // Score recording functions
  recordScore,
  recordToolSuccessScore,
  recordFailureCategoryScore,
  recordErrorSeverityScore,
  recordCascadeFailureScore,
  recordSessionSuccessRateScore,
  recordSessionHealthScore,
  recordDominantFailureModeScore,
  // Composite recording functions
  recordToolFailureScores,
  recordToolSuccessScores,
  recordSessionHealthScores,
  // Types
  type FailureCategory,
  type SessionHealth,
  type RecordScoreOptions,
} from './scores.js';

// Persistence exports for cross-process span linking
export {
  loadSpanState,
  saveSpanState,
  deleteSpanState,
  cleanupOldStates,
  registerActiveSpan,
  popActiveSpan,
  getSessionInfo,
  initSession,
  createEmptyMetrics,
  updateSessionMetrics,
  getSessionMetrics,
  calculateAggregateMetrics,
  // Pending parent context for subagent linking
  storePendingParentContext,
  findPendingParentContext,
  removePendingParentContext,
  cleanupPendingParentContexts,
  // Extended functions for SubagentStop cleanup
  findPendingParentContextBySession,
  findAndRemovePendingParentContextBySession,
  // Event deduplication for cross-process duplicate prevention
  createEventFingerprint,
  hasProcessedEvent,
  markEventProcessed,
  cleanupProcessedEvents,
  // Tool chain state for cascade failure detection
  getToolChainContext,
  updateToolChainState,
  resetToolChainState,
  type PersistedSpanState,
  type TokenData,
  type PendingParentContext,
} from './persistence.js';
