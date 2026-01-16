/**
 * File-based persistence for span state across process invocations.
 *
 * Each Claude Code hook invocation is a SEPARATE Node.js process:
 * - Process 1: PreToolUse event -> creates span -> exits (span context lost!)
 * - Process 2: PostToolUse event -> needs to find/update span -> can't find it
 *
 * This module provides file-based persistence to store span state across
 * process invocations, enabling proper span linking and duration calculation.
 */

import {
  writeFileSync,
  readFileSync,
  unlinkSync,
  existsSync,
  mkdirSync,
  readdirSync,
  renameSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { SpanState, ActiveSpanInfo, SessionMetrics, ToolChainContext } from './types.js';

/** Directory for storing span state files */
const PERSISTENCE_DIR = join(tmpdir(), 'langfuse-claude-code');

/** Prefix for state files */
const STATE_PREFIX = 'state-';

/** Prefix for pending parent context files (for subagent linking) */
const PENDING_PARENT_PREFIX = 'pending-parent-';

/** Maximum age for state files before cleanup (24 hours) */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Maximum age for pending parent context for initial linking (5 minutes - subagent should start quickly) */
const PENDING_PARENT_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Extended TTL for pending parent context to support long-running subagents.
 * This is used for cleanup AFTER the subagent has started and is actively running.
 * Long-running subagents (e.g., complex multi-step tasks) may run for 30+ minutes.
 */
const PENDING_PARENT_TTL_MS = 30 * 60 * 1000;

/**
 * Extended SpanState with creation timestamp for cleanup purposes.
 */
export interface PersistedSpanState extends SpanState {
  /** Timestamp when the state was created (ms since epoch) */
  createdAt: number;
  // Note: processedEvents is inherited from SpanState
}

/** Maximum number of processed events to keep per session (to prevent unbounded growth) */
const MAX_PROCESSED_EVENTS = 1000;

/** Maximum age for processed event fingerprints before cleanup (10 minutes in seconds) */
const PROCESSED_EVENT_MAX_AGE_SECONDS = 600;

/**
 * Get the file path for a session's state file.
 *
 * @param sessionId - The session identifier
 * @returns The absolute path to the state file
 */
function getStatePath(sessionId: string): string {
  // Sanitize sessionId to prevent path traversal
  const sanitizedId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(PERSISTENCE_DIR, `${STATE_PREFIX}${sanitizedId}.json`);
}

/**
 * Ensure the persistence directory exists.
 */
function ensureDir(): void {
  if (!existsSync(PERSISTENCE_DIR)) {
    mkdirSync(PERSISTENCE_DIR, { recursive: true, mode: 0o700 });
  }
}

/**
 * Load span state for a session from disk.
 *
 * @param sessionId - The session identifier
 * @returns The persisted span state, or null if not found
 */
export function loadSpanState(sessionId: string): PersistedSpanState | null {
  try {
    const path = getStatePath(sessionId);
    if (!existsSync(path)) return null;
    const data = readFileSync(path, 'utf8');
    return JSON.parse(data) as PersistedSpanState;
  } catch {
    return null;
  }
}

/**
 * Save span state for a session to disk.
 * Uses atomic write (write to temp, then rename) to prevent corruption.
 *
 * @param sessionId - The session identifier
 * @param state - The span state to persist
 */
export function saveSpanState(sessionId: string, state: PersistedSpanState): void {
  try {
    ensureDir();
    const path = getStatePath(sessionId);
    const tempPath = `${path}.tmp.${process.pid}`;

    // Write to temp file first
    writeFileSync(tempPath, JSON.stringify(state), { encoding: 'utf8', mode: 0o600 });

    // Atomic rename
    renameSync(tempPath, path);
  } catch (e) {
    console.error(`[Langfuse] Failed to save state: ${e}`);
  }
}

/**
 * Delete span state for a session.
 *
 * @param sessionId - The session identifier
 */
export function deleteSpanState(sessionId: string): void {
  try {
    const path = getStatePath(sessionId);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

/**
 * Clean up old state files that exceed the maximum age.
 * Should be called periodically to prevent disk space accumulation.
 */
export function cleanupOldStates(): void {
  try {
    if (!existsSync(PERSISTENCE_DIR)) return;

    const files = readdirSync(PERSISTENCE_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.startsWith(STATE_PREFIX)) continue;

      try {
        const path = join(PERSISTENCE_DIR, file);
        const data = readFileSync(path, 'utf8');
        const state = JSON.parse(data) as PersistedSpanState;

        if (now - state.createdAt > MAX_AGE_MS) {
          unlinkSync(path);
        }
      } catch {
        // Ignore individual file errors, continue with others
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Register a new active span for cross-process linking.
 * Called in PreToolUse to persist span info for later retrieval in PostToolUse.
 *
 * @param sessionId - The session identifier
 * @param toolUseId - The unique tool use identifier
 * @param spanInfo - The span information to persist (object with spanId, traceId, parentSpanId, etc.)
 */
export function registerActiveSpan(
  sessionId: string,
  toolUseId: string,
  spanInfo: ActiveSpanInfo
): void {
  let state = loadSpanState(sessionId);

  if (!state) {
    state = {
      traceId: spanInfo.traceId || '',
      sessionSpanId: spanInfo.parentSpanId || '',
      activeSpans: {},
      createdAt: Date.now(),
    };
  }

  state.activeSpans[toolUseId] = {
    spanId: spanInfo.spanId,
    observationId: spanInfo.observationId,
    startTime: spanInfo.startTime ?? Date.now(),
    traceId: spanInfo.traceId,
    parentSpanId: spanInfo.parentSpanId,
    parentObservationId: spanInfo.parentObservationId,
    traceparent: spanInfo.traceparent,
    ctx: spanInfo.ctx,
    parent_tool_use_id: spanInfo.parent_tool_use_id,
  };

  saveSpanState(sessionId, state);
}

/**
 * Retrieve and remove an active span for cross-process linking.
 * Called in PostToolUse to get span info persisted by PreToolUse.
 *
 * @param sessionId - The session identifier
 * @param toolUseId - The unique tool use identifier
 * @returns The span info including trace context and hierarchy info, or null if not found
 */
export function popActiveSpan(
  sessionId: string,
  toolUseId: string
): (ActiveSpanInfo & { sessionSpanId: string }) | null {
  const state = loadSpanState(sessionId);
  if (!state || !state.activeSpans[toolUseId]) return null;

  const span = state.activeSpans[toolUseId];
  delete state.activeSpans[toolUseId];
  saveSpanState(sessionId, state);

  return {
    ...span,
    // Ensure traceId falls back to state-level if not in span
    traceId: span.traceId || state.traceId,
    sessionSpanId: state.sessionSpanId,
  };
}

/**
 * Get session info (trace ID, session span ID, traceparent, createdAt) for a session.
 *
 * @param sessionId - The session identifier
 * @returns The session trace context, or null if not found
 */
export function getSessionInfo(
  sessionId: string
): { traceId: string; sessionSpanId: string; traceparent?: string; createdAt?: number } | null {
  const state = loadSpanState(sessionId);
  if (!state) return null;

  return {
    traceId: state.traceId,
    sessionSpanId: state.sessionSpanId,
    traceparent: state.traceparent,
    createdAt: state.createdAt,
  };
}

/**
 * Initialize or update a session's trace context.
 * Called when a session is first seen to persist the trace/span IDs.
 *
 * @param sessionId - The session identifier
 * @param traceId - The trace ID for this session
 * @param sessionSpanId - The session-level span ID
 * @param traceparent - Optional W3C traceparent for context propagation
 */
export function initSession(
  sessionId: string,
  traceId: string,
  sessionSpanId: string,
  traceparent?: string
): void {
  let state = loadSpanState(sessionId);

  if (!state) {
    state = {
      traceId,
      sessionSpanId,
      traceparent,
      activeSpans: {},
      createdAt: Date.now(),
      metrics: createEmptyMetrics(),
    };
    saveSpanState(sessionId, state);
  } else if (traceparent && !state.traceparent) {
    // Update existing state with traceparent if missing (backward compat)
    state.traceparent = traceparent;
    saveSpanState(sessionId, state);
  }
}

/**
 * Create an empty SessionMetrics object.
 */
export function createEmptyMetrics(): SessionMetrics {
  return {
    toolCount: 0,
    subagentCount: 0,
    errorCount: 0,
    totalDurationMs: 0,
    toolDurations: [],
    errorsByType: {},
    toolsByName: {},
    totalInputTokens: 0,
    totalOutputTokens: 0,
    tokensByTool: {},
    toolsByModel: {},
    modelsUsed: [],
  };
}

/**
 * Token usage data for metrics tracking.
 */
export interface TokenData {
  input?: number;
  output?: number;
  total?: number;
}

/**
 * Update session metrics after a tool execution completes.
 *
 * @param sessionId - The session identifier
 * @param toolName - Name of the tool that executed
 * @param isSubagent - Whether the tool is a subagent (Task tool)
 * @param success - Whether the tool execution succeeded
 * @param errorType - Type of error if failed (optional)
 * @param durationMs - Duration of the tool execution in milliseconds (optional)
 * @param tokens - Token usage data (optional)
 * @param model - Model that executed this tool call (optional)
 */
export function updateSessionMetrics(
  sessionId: string,
  toolName: string,
  isSubagent: boolean,
  success: boolean,
  errorType?: string,
  durationMs?: number,
  tokens?: TokenData,
  model?: string
): void {
  const state = loadSpanState(sessionId);
  if (!state) return;

  // Initialize metrics if not present
  if (!state.metrics) {
    state.metrics = createEmptyMetrics();
  }

  const metrics = state.metrics;

  // Increment tool count
  metrics.toolCount++;

  // Increment subagent count if applicable
  if (isSubagent) {
    metrics.subagentCount++;
  }

  // Track tool usage by name
  metrics.toolsByName[toolName] = (metrics.toolsByName[toolName] || 0) + 1;

  // Handle errors
  if (!success) {
    metrics.errorCount++;
    if (errorType) {
      metrics.errorsByType[errorType] = (metrics.errorsByType[errorType] || 0) + 1;
    }
  }

  // Track duration if provided
  if (durationMs !== undefined) {
    metrics.totalDurationMs += durationMs;
    metrics.toolDurations.push(durationMs);
  }

  // Track token usage if provided
  if (tokens) {
    if (tokens.input !== undefined) {
      metrics.totalInputTokens += tokens.input;
    }
    if (tokens.output !== undefined) {
      metrics.totalOutputTokens += tokens.output;
    }

    // Track per-tool token usage
    if (!metrics.tokensByTool[toolName]) {
      metrics.tokensByTool[toolName] = { input: 0, output: 0, total: 0 };
    }
    const toolTokens = metrics.tokensByTool[toolName];
    if (tokens.input !== undefined) {
      toolTokens.input = (toolTokens.input || 0) + tokens.input;
    }
    if (tokens.output !== undefined) {
      toolTokens.output = (toolTokens.output || 0) + tokens.output;
    }
    if (tokens.total !== undefined) {
      toolTokens.total = (toolTokens.total || 0) + tokens.total;
    }
  }

  // Track model usage if provided
  if (model) {
    metrics.toolsByModel[model] = (metrics.toolsByModel[model] || 0) + 1;
    if (!metrics.modelsUsed.includes(model)) {
      metrics.modelsUsed.push(model);
    }
  }

  saveSpanState(sessionId, state);
}

/**
 * Get session metrics for a session.
 *
 * @param sessionId - The session identifier
 * @returns The session metrics, or null if not found
 */
export function getSessionMetrics(sessionId: string): SessionMetrics | null {
  const state = loadSpanState(sessionId);
  if (!state || !state.metrics) return null;
  return state.metrics;
}

/**
 * Calculate aggregate performance metrics from session metrics.
 *
 * @param metrics - The session metrics
 * @returns Aggregate metrics including averages, min, max, token usage, and model breakdown
 */
export function calculateAggregateMetrics(metrics: SessionMetrics): {
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  toolBreakdown: Record<string, number>;
  errorBreakdown: Record<string, number>;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  tokensByTool: Record<string, { input?: number; output?: number; total?: number }>;
  modelBreakdown: Record<string, number>;
  modelsUsed: string[];
} {
  const durations = metrics.toolDurations;
  const hasDurations = durations.length > 0;

  return {
    avgDurationMs: hasDurations ? Math.round(metrics.totalDurationMs / durations.length) : 0,
    minDurationMs: hasDurations ? Math.min(...durations) : 0,
    maxDurationMs: hasDurations ? Math.max(...durations) : 0,
    toolBreakdown: { ...metrics.toolsByName },
    errorBreakdown: { ...metrics.errorsByType },
    totalInputTokens: metrics.totalInputTokens,
    totalOutputTokens: metrics.totalOutputTokens,
    totalTokens: metrics.totalInputTokens + metrics.totalOutputTokens,
    tokensByTool: { ...metrics.tokensByTool },
    modelBreakdown: { ...metrics.toolsByModel },
    modelsUsed: [...metrics.modelsUsed],
  };
}

// =============================================================================
// Pending Parent Context (for cross-session subagent linking)
// =============================================================================

/**
 * Pending parent context for subagent linking.
 * Stored when a Task tool is invoked so the spawned subagent can link to it.
 */
export interface PendingParentContext {
  /** W3C traceparent of the parent's Agent observation */
  traceparent: string;
  /** Trace ID of the parent session */
  traceId: string;
  /** Observation ID of the Agent observation (Task tool) */
  observationId: string;
  /** Session ID of the parent session */
  parentSessionId: string;
  /** Tool use ID of the Task tool call */
  toolUseId: string;
  /** Subagent type (from Task tool input) */
  subagentType?: string;
  /** Timestamp when created (for cleanup) */
  createdAt: number;
}

/**
 * Get file path for pending parent context.
 * Uses a timestamp-based name since we don't know the subagent's session ID yet.
 */
function getPendingParentPath(parentSessionId: string, toolUseId: string): string {
  const sanitizedSessionId = parentSessionId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const sanitizedToolUseId = toolUseId.replace(/[^a-zA-Z0-9_-]/g, '_');
  return join(
    PERSISTENCE_DIR,
    `${PENDING_PARENT_PREFIX}${sanitizedSessionId}-${sanitizedToolUseId}.json`
  );
}

/**
 * Store pending parent context when a Task tool is invoked.
 * The spawned subagent will look for this to link itself to the parent's trace.
 *
 * @param ctx - The pending parent context
 */
export function storePendingParentContext(ctx: PendingParentContext): void {
  try {
    ensureDir();
    const path = getPendingParentPath(ctx.parentSessionId, ctx.toolUseId);
    const tempPath = `${path}.tmp.${process.pid}`;
    writeFileSync(tempPath, JSON.stringify(ctx), { encoding: 'utf8', mode: 0o600 });
    renameSync(tempPath, path);
  } catch (e) {
    console.error(`[Langfuse] Failed to store pending parent context: ${e}`);
  }
}

/**
 * Find and retrieve any pending parent context for subagent linking.
 * Returns the most recent pending context that hasn't expired.
 * Used by a new session to check if it should link to a parent trace.
 *
 * @returns The pending parent context if found, null otherwise
 */
export function findPendingParentContext(): PendingParentContext | null {
  try {
    if (!existsSync(PERSISTENCE_DIR)) return null;

    const files = readdirSync(PERSISTENCE_DIR);
    const now = Date.now();
    let mostRecent: PendingParentContext | null = null;
    let mostRecentTime = 0;

    for (const file of files) {
      if (!file.startsWith(PENDING_PARENT_PREFIX)) continue;

      try {
        const path = join(PERSISTENCE_DIR, file);
        const data = readFileSync(path, 'utf8');
        const ctx = JSON.parse(data) as PendingParentContext;

        // Skip expired contexts
        if (now - ctx.createdAt > PENDING_PARENT_MAX_AGE_MS) {
          // Clean up expired file
          try {
            unlinkSync(path);
          } catch {
            /* ignore */
          }
          continue;
        }

        // Track the most recent valid context
        if (ctx.createdAt > mostRecentTime) {
          mostRecent = ctx;
          mostRecentTime = ctx.createdAt;
        }
      } catch {
        // Skip invalid files
      }
    }

    return mostRecent;
  } catch {
    return null;
  }
}

/**
 * Remove a pending parent context after it's been used or the Task completes.
 *
 * @param parentSessionId - The parent session ID
 * @param toolUseId - The Task tool use ID
 */
export function removePendingParentContext(parentSessionId: string, toolUseId: string): void {
  try {
    const path = getPendingParentPath(parentSessionId, toolUseId);
    if (existsSync(path)) {
      unlinkSync(path);
    }
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Find pending parent context that matches a subagent session.
 * Used by SubagentStop to find the parent context for cleanup after the subagent completes.
 *
 * This function searches for pending parent contexts that:
 * 1. Match by traceparent if provided (most reliable)
 * 2. Are within the extended TTL window (30 minutes for long-running subagents)
 *
 * @param subagentSessionId - The subagent's session ID (for logging/debugging)
 * @param parentTraceparent - Optional traceparent from the subagent's session to match
 * @returns The matching pending parent context, or null if not found
 */
export function findPendingParentContextBySession(
  _subagentSessionId: string,
  parentTraceparent?: string
): PendingParentContext | null {
  try {
    if (!existsSync(PERSISTENCE_DIR)) return null;

    const files = readdirSync(PERSISTENCE_DIR);
    const now = Date.now();
    let bestMatch: PendingParentContext | null = null;

    for (const file of files) {
      if (!file.startsWith(PENDING_PARENT_PREFIX)) continue;

      try {
        const path = join(PERSISTENCE_DIR, file);
        const data = readFileSync(path, 'utf8');
        const ctx = JSON.parse(data) as PendingParentContext;

        // Skip contexts that are too old (using extended TTL for running subagents)
        if (now - ctx.createdAt > PENDING_PARENT_TTL_MS) {
          continue;
        }

        // Best match: traceparent matches exactly
        if (parentTraceparent && ctx.traceparent === parentTraceparent) {
          return ctx; // Exact match, return immediately
        }

        // Otherwise, track the most recent context as a potential match
        // (SubagentStop may not have traceparent in cross-process scenario)
        if (!bestMatch || ctx.createdAt > bestMatch.createdAt) {
          bestMatch = ctx;
        }
      } catch {
        // Skip invalid files
      }
    }

    return bestMatch;
  } catch {
    return null;
  }
}

/**
 * Find and remove pending parent context for a subagent session.
 * This is the primary function for SubagentStop to use - it finds the context,
 * returns it for use, and then removes it.
 *
 * @param subagentSessionId - The subagent's session ID
 * @param parentTraceparent - Optional traceparent to match
 * @returns The matching context if found (already removed), or null
 */
export function findAndRemovePendingParentContextBySession(
  subagentSessionId: string,
  parentTraceparent?: string
): PendingParentContext | null {
  const ctx = findPendingParentContextBySession(subagentSessionId, parentTraceparent);

  if (ctx) {
    // Remove the context now that we've found it
    removePendingParentContext(ctx.parentSessionId, ctx.toolUseId);
  }

  return ctx;
}

/**
 * Clean up all expired pending parent contexts.
 */
export function cleanupPendingParentContexts(): void {
  try {
    if (!existsSync(PERSISTENCE_DIR)) return;

    const files = readdirSync(PERSISTENCE_DIR);
    const now = Date.now();

    for (const file of files) {
      if (!file.startsWith(PENDING_PARENT_PREFIX)) continue;

      try {
        const path = join(PERSISTENCE_DIR, file);
        const data = readFileSync(path, 'utf8');
        const ctx = JSON.parse(data) as PendingParentContext;

        if (now - ctx.createdAt > PENDING_PARENT_MAX_AGE_MS) {
          unlinkSync(path);
        }
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Ignore cleanup errors
  }
}

// =============================================================================
// Event Deduplication (prevents duplicate events across processes)
// =============================================================================

/**
 * Create an event fingerprint for deduplication.
 * Format: `${hook_event_name}:${tool_use_id || timestamp_bucket}`
 * where timestamp_bucket is `Math.floor(Date.now() / 1000)` (1-second buckets)
 *
 * @param hookEventName - The hook event name (e.g., "UserPromptSubmit", "SubagentStop")
 * @param toolUseId - Optional tool use ID for tool-related events
 * @returns A fingerprint string for deduplication
 */
export function createEventFingerprint(hookEventName: string, toolUseId?: string): string {
  if (toolUseId) {
    return `${hookEventName}:${toolUseId}`;
  }
  // Use 1-second timestamp buckets for events without tool_use_id
  const timestampBucket = Math.floor(Date.now() / 1000);
  return `${hookEventName}:${timestampBucket}`;
}

/**
 * Check if an event has already been processed for a session.
 *
 * @param sessionId - The session identifier
 * @param fingerprint - The event fingerprint to check
 * @returns true if the event has already been processed, false otherwise
 */
export function hasProcessedEvent(sessionId: string, fingerprint: string): boolean {
  const state = loadSpanState(sessionId);
  if (!state) return false;

  // Handle backwards compatibility - older states may not have processedEvents
  if (!state.processedEvents) return false;

  return state.processedEvents.includes(fingerprint);
}

/**
 * Mark an event as processed for a session.
 * Uses atomic file operations and cleans up old fingerprints.
 *
 * @param sessionId - The session identifier
 * @param fingerprint - The event fingerprint to mark as processed
 */
export function markEventProcessed(sessionId: string, fingerprint: string): void {
  const state = loadSpanState(sessionId);
  if (!state) return;

  // Initialize processedEvents if not present (backwards compatibility)
  if (!state.processedEvents) {
    state.processedEvents = [];
  }

  // Don't add duplicates
  if (state.processedEvents.includes(fingerprint)) {
    return;
  }

  // Add the new fingerprint
  state.processedEvents.push(fingerprint);

  // Clean up old fingerprints if we have too many
  if (state.processedEvents.length > MAX_PROCESSED_EVENTS) {
    // Keep only the most recent fingerprints
    state.processedEvents = state.processedEvents.slice(-MAX_PROCESSED_EVENTS);
  }

  saveSpanState(sessionId, state);
}

/**
 * Clean up old processed event fingerprints for a session.
 * Called during cleanupOldStates to remove stale fingerprints.
 *
 * @param sessionId - The session identifier
 */
export function cleanupProcessedEvents(sessionId: string): void {
  const state = loadSpanState(sessionId);
  if (!state || !state.processedEvents) return;

  const now = Math.floor(Date.now() / 1000);

  // Filter out fingerprints older than PROCESSED_EVENT_MAX_AGE_SECONDS
  // Fingerprints with timestamp buckets are in format "EventName:timestamp"
  const filtered = state.processedEvents.filter((fp) => {
    const parts = fp.split(':');
    if (parts.length < 2) return true; // Keep malformed fingerprints

    const lastPart = parts[parts.length - 1];
    const timestamp = parseInt(lastPart, 10);

    // If not a valid timestamp (e.g., it's a tool_use_id), keep it
    if (isNaN(timestamp) || timestamp > 2000000000) return true;

    // If timestamp is within the max age, keep it
    return now - timestamp < PROCESSED_EVENT_MAX_AGE_SECONDS;
  });

  if (filtered.length !== state.processedEvents.length) {
    state.processedEvents = filtered;
    saveSpanState(sessionId, state);
  }
}

// =============================================================================
// Tool Chain State Management
// =============================================================================

/**
 * Get the current tool chain context for a session.
 * Returns information about the preceding tool for cascade failure detection.
 *
 * @param sessionId - The session identifier
 * @returns Tool chain context, or undefined if no chain state exists
 */
export function getToolChainContext(sessionId: string): ToolChainContext | undefined {
  const state = loadSpanState(sessionId);
  if (!state?.toolChain) {
    // Return initial context for first tool
    return {
      position: 1,
    };
  }

  const { chainPosition, lastToolName, lastToolSuccess } = state.toolChain;

  return {
    position: chainPosition + 1,
    precedingTool: lastToolName,
    precedingSuccess: lastToolSuccess,
  };
}

/**
 * Update the tool chain state after a tool completes.
 * This should be called in PostToolUse after processing results.
 *
 * @param sessionId - The session identifier
 * @param toolName - Name of the completed tool
 * @param success - Whether the tool succeeded
 */
export function updateToolChainState(sessionId: string, toolName: string, success: boolean): void {
  const state = loadSpanState(sessionId);
  if (!state) return;

  const currentPosition = state.toolChain?.chainPosition ?? 0;

  state.toolChain = {
    chainPosition: currentPosition + 1,
    lastToolName: toolName,
    lastToolSuccess: success,
  };

  saveSpanState(sessionId, state);
}

/**
 * Reset the tool chain state for a session.
 * Called when starting a new logical chain of operations.
 *
 * @param sessionId - The session identifier
 */
export function resetToolChainState(sessionId: string): void {
  const state = loadSpanState(sessionId);
  if (!state) return;

  state.toolChain = {
    chainPosition: 0,
    lastToolName: undefined,
    lastToolSuccess: undefined,
  };

  saveSpanState(sessionId, state);
}
