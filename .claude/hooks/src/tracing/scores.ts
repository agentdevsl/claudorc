/**
 * Score constants and helpers for Langfuse failure tracking.
 * Provides type-safe score names, categorical values, and idempotency key generation.
 */

import { LangfuseClient } from '@langfuse/client';

// Score data types supported by Langfuse
type ScoreDataType = 'NUMERIC' | 'BOOLEAN' | 'CATEGORICAL';

// =============================================================================
// Score Names (Constants)
// =============================================================================

/** Boolean score indicating tool success (1) or failure (0) */
export const SCORE_TOOL_SUCCESS = 'tool_success';

/** Categorical score for failure classification */
export const SCORE_FAILURE_CATEGORY = 'failure_category';

/** Numeric score for error severity (0.0-1.0) */
export const SCORE_ERROR_SEVERITY = 'error_severity';

/** Session-level success rate (0.0-1.0) */
export const SCORE_SESSION_SUCCESS_RATE = 'session_success_rate';

/** Session health categorical: healthy, degraded, unhealthy */
export const SCORE_SESSION_HEALTH = 'session_health';

/** Dominant failure mode in session */
export const SCORE_DOMINANT_FAILURE_MODE = 'dominant_failure_mode';

/** Boolean indicator for cascade failures */
export const SCORE_IS_CASCADE_FAILURE = 'is_cascade_failure';

// =============================================================================
// Failure Categories (matching errorType values from utils.ts)
// =============================================================================

export const FAILURE_CATEGORIES = [
  'error', // Generic error field present
  'failed', // success === false
  'exit_code', // Non-zero exit code
  'http_server_error', // HTTP 5xx
  'http_client_error', // HTTP 4xx
  'timeout', // Operation timed out
  'cancelled', // Operation cancelled
  'not_found', // Resource not found
  'permission_denied', // Permission denied
  'incomplete', // Session ended before completion
  'unknown', // Unknown error type
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

// =============================================================================
// Session Health Categories
// =============================================================================

export const SESSION_HEALTH_VALUES = {
  HEALTHY: 'healthy', // 0 errors
  DEGRADED: 'degraded', // 1-2 errors
  UNHEALTHY: 'unhealthy', // 3+ errors
} as const;

export type SessionHealth = (typeof SESSION_HEALTH_VALUES)[keyof typeof SESSION_HEALTH_VALUES];

// =============================================================================
// Error Severity Mapping
// =============================================================================

/**
 * Severity scores by error type (0.0-1.0 scale).
 * Higher values = more critical issues requiring attention.
 */
export const ERROR_SEVERITY: Record<string, number> = {
  permission_denied: 0.9, // Critical - likely blocks workflow
  incomplete: 0.85, // High - session ended unexpectedly
  exit_code: 0.8, // High - command failed
  timeout: 0.75, // High - resource/performance issues
  http_server_error: 0.7, // High - server error
  error: 0.6, // Medium-high - explicit error
  failed: 0.5, // Medium - generic failure
  http_client_error: 0.5, // Medium - client error (might be expected)
  not_found: 0.4, // Medium-low - resource missing
  cancelled: 0.3, // Low - user-initiated
  unknown: 0.5, // Default for unknown types
};

/**
 * Get severity score for an error type.
 *
 * @param errorType - The error type from tool analysis
 * @returns Severity score between 0.0 and 1.0
 */
export function getErrorSeverity(errorType?: string | null): number {
  if (!errorType) return ERROR_SEVERITY.unknown;
  return ERROR_SEVERITY[errorType] ?? ERROR_SEVERITY.unknown;
}

/**
 * Find the dominant (most frequent) failure mode from a map of error counts.
 * When counts are tied, returns the first error type alphabetically for consistency.
 *
 * @param errorsByType - Map of error type to count
 * @returns The dominant error type, or undefined if empty
 */
export function findDominantFailureMode(errorsByType: Record<string, number>): string | undefined {
  const entries = Object.entries(errorsByType);
  if (entries.length === 0) return undefined;

  // Sort by count descending, then by error type alphabetically for tie-breaking
  const sorted = entries.sort(([typeA, countA], [typeB, countB]) => {
    if (countB !== countA) return countB - countA;
    return typeA.localeCompare(typeB);
  });

  return sorted[0][0];
}

// =============================================================================
// Idempotency Key Generation
// =============================================================================

/**
 * Generate an idempotency key for a score.
 * Using consistent keys prevents duplicate scores on retry/reprocessing.
 *
 * @param observationId - The observation ID the score is attached to
 * @param scoreName - The score name constant
 * @returns Idempotency key string
 */
export function createScoreIdempotencyKey(observationId: string, scoreName: string): string {
  return `${observationId}-${scoreName}`;
}

// =============================================================================
// Score Recording Functions
// =============================================================================

/**
 * Options for recording a score.
 */
export interface RecordScoreOptions {
  /** Langfuse client instance */
  langfuse: LangfuseClient;
  /** Trace ID the score belongs to */
  traceId: string;
  /** Observation ID the score is attached to */
  observationId: string;
  /** Score name (use constants above) */
  name: string;
  /** Score value (number, string, or boolean as 0/1) */
  value: number | string;
  /** Data type for the score */
  dataType: ScoreDataType;
  /** Optional comment for additional context */
  comment?: string;
}

/**
 * Record a score with idempotency key to prevent duplicates.
 * Errors are logged but do not throw - score recording should not fail the observation.
 *
 * @param options - Score recording options
 */
export async function recordScore(options: RecordScoreOptions): Promise<void> {
  const { langfuse, traceId, observationId, name, value, dataType, comment } = options;

  try {
    const scoreId = createScoreIdempotencyKey(observationId, name);
    console.error(
      `[Langfuse] Recording score: ${name}=${value} traceId=${traceId?.substring(0, 8)} obsId=${observationId?.substring(0, 8)} scoreId=${scoreId?.substring(0, 16)}`
    );
    langfuse.score.create({
      id: scoreId,
      traceId,
      observationId,
      name,
      value,
      dataType,
      comment,
    });
  } catch (error) {
    // Log but don't throw - score recording should not fail the observation
    console.error(`[Langfuse] Failed to record score ${name}: ${error}`);
  }
}

/**
 * Record tool success as a boolean score.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 * @param success - Whether the tool succeeded
 */
export async function recordToolSuccessScore(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string,
  success: boolean
): Promise<void> {
  await recordScore({
    langfuse,
    traceId,
    observationId,
    name: SCORE_TOOL_SUCCESS,
    value: success ? 1 : 0,
    dataType: 'BOOLEAN',
  });
}

/**
 * Record failure category as a categorical score.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 * @param errorType - The error type from tool analysis
 */
export async function recordFailureCategoryScore(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string,
  errorType?: string | null
): Promise<void> {
  const category =
    errorType && FAILURE_CATEGORIES.includes(errorType as FailureCategory) ? errorType : 'unknown';

  await recordScore({
    langfuse,
    traceId,
    observationId,
    name: SCORE_FAILURE_CATEGORY,
    value: category,
    dataType: 'CATEGORICAL',
  });
}

/**
 * Record error severity as a numeric score.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 * @param errorType - The error type from tool analysis
 */
export async function recordErrorSeverityScore(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string,
  errorType?: string | null
): Promise<void> {
  await recordScore({
    langfuse,
    traceId,
    observationId,
    name: SCORE_ERROR_SEVERITY,
    value: getErrorSeverity(errorType),
    dataType: 'NUMERIC',
  });
}

/**
 * Record cascade failure indicator.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 * @param isCascade - Whether this failure was caused by a preceding failure
 */
export async function recordCascadeFailureScore(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string,
  isCascade: boolean
): Promise<void> {
  await recordScore({
    langfuse,
    traceId,
    observationId,
    name: SCORE_IS_CASCADE_FAILURE,
    value: isCascade ? 1 : 0,
    dataType: 'BOOLEAN',
  });
}

// =============================================================================
// Session-Level Scores
// =============================================================================

/**
 * Calculate session health based on error count.
 *
 * @param errorCount - Number of errors in the session
 * @returns Session health category
 */
export function calculateSessionHealth(errorCount: number): SessionHealth {
  if (errorCount === 0) return SESSION_HEALTH_VALUES.HEALTHY;
  if (errorCount <= 2) return SESSION_HEALTH_VALUES.DEGRADED;
  return SESSION_HEALTH_VALUES.UNHEALTHY;
}

/**
 * Record session success rate as a numeric score.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID (session trace)
 * @param toolCount - Total number of tools executed
 * @param errorCount - Number of failed tools
 */
export async function recordSessionSuccessRateScore(
  langfuse: LangfuseClient,
  traceId: string,
  toolCount: number,
  errorCount: number
): Promise<void> {
  const successRate = toolCount > 0 ? 1 - errorCount / toolCount : 1;

  await recordScore({
    langfuse,
    traceId,
    observationId: traceId, // Session-level score attached to trace
    name: SCORE_SESSION_SUCCESS_RATE,
    value: Math.round(successRate * 100) / 100, // Round to 2 decimal places
    dataType: 'NUMERIC',
  });
}

/**
 * Record session health as a categorical score.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID (session trace)
 * @param errorCount - Number of errors in the session
 */
export async function recordSessionHealthScore(
  langfuse: LangfuseClient,
  traceId: string,
  errorCount: number
): Promise<void> {
  await recordScore({
    langfuse,
    traceId,
    observationId: traceId, // Session-level score attached to trace
    name: SCORE_SESSION_HEALTH,
    value: calculateSessionHealth(errorCount),
    dataType: 'CATEGORICAL',
  });
}

/**
 * Record dominant failure mode for the session.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID (session trace)
 * @param errorsByType - Map of error type to count
 */
export async function recordDominantFailureModeScore(
  langfuse: LangfuseClient,
  traceId: string,
  errorsByType: Record<string, number>
): Promise<void> {
  const dominantType = findDominantFailureMode(errorsByType);
  if (!dominantType) return;

  await recordScore({
    langfuse,
    traceId,
    observationId: traceId, // Session-level score attached to trace
    name: SCORE_DOMINANT_FAILURE_MODE,
    value: dominantType,
    dataType: 'CATEGORICAL',
  });
}

// =============================================================================
// Composite Recording Functions
// =============================================================================

/**
 * Record all failure-related scores for a failed tool observation.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 * @param errorType - The error type from tool analysis
 * @param precedingToolFailed - Whether the preceding tool in the chain failed
 */
export async function recordToolFailureScores(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string,
  errorType?: string | null,
  precedingToolFailed?: boolean
): Promise<void> {
  // Record all failure scores in parallel
  await Promise.all([
    recordToolSuccessScore(langfuse, traceId, observationId, false),
    recordFailureCategoryScore(langfuse, traceId, observationId, errorType),
    recordErrorSeverityScore(langfuse, traceId, observationId, errorType),
    ...(precedingToolFailed !== undefined
      ? [recordCascadeFailureScore(langfuse, traceId, observationId, precedingToolFailed)]
      : []),
  ]);
}

/**
 * Record success score for a successful tool observation.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID
 * @param observationId - Observation ID
 */
export async function recordToolSuccessScores(
  langfuse: LangfuseClient,
  traceId: string,
  observationId: string
): Promise<void> {
  await recordToolSuccessScore(langfuse, traceId, observationId, true);
}

/**
 * Record all session-level health scores.
 *
 * @param langfuse - Langfuse client
 * @param traceId - Trace ID (session trace)
 * @param toolCount - Total number of tools executed
 * @param errorCount - Number of failed tools
 * @param errorsByType - Map of error type to count
 */
export async function recordSessionHealthScores(
  langfuse: LangfuseClient,
  traceId: string,
  toolCount: number,
  errorCount: number,
  errorsByType: Record<string, number>
): Promise<void> {
  const promises: Promise<void>[] = [
    recordSessionSuccessRateScore(langfuse, traceId, toolCount, errorCount),
    recordSessionHealthScore(langfuse, traceId, errorCount),
  ];

  // Only record dominant failure mode if there were errors
  if (errorCount > 0 && Object.keys(errorsByType).length > 0) {
    promises.push(recordDominantFailureModeScore(langfuse, traceId, errorsByType));
  }

  await Promise.all(promises);
}
