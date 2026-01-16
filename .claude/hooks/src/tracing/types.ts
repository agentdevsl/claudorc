/**
 * Type definitions for the Langfuse tracing module.
 * Provides type-safe interfaces for span state management,
 * session context, and tool context.
 */

/**
 * Represents the state of spans tracked in persistent storage.
 * Used to maintain span relationships across stateless hook processes.
 */
export interface SpanState {
  /** The trace ID for the current session */
  traceId: string;
  /** The span ID of the session-level observation */
  sessionSpanId: string;
  /** W3C traceparent for OTel context propagation (format: {version}-{trace-id}-{span-id}-{flags}) */
  traceparent?: string;
  /** Map of tool_use_id to span information for active tools */
  activeSpans: Record<string, ActiveSpanInfo>;
  /** Session-level metrics accumulated across tool executions */
  metrics?: SessionMetrics;
  /** Set of event fingerprints that have been processed (for deduplication) */
  processedEvents?: string[];
  /** Tool chain state for tracking sequential execution and cascade failures */
  toolChain?: ToolChainState;
}

/**
 * Information about an active span.
 * Extended to support cross-process parent-child hierarchy recovery.
 */
export interface ActiveSpanInfo {
  /** The OpenTelemetry span ID */
  spanId: string;
  /** The Langfuse observation ID (for upsert in PostToolUse) */
  observationId?: string;
  /** Timestamp when the span started (ms since epoch) */
  startTime: number;
  /** The trace ID for linking */
  traceId?: string;
  /** The parent span ID for hierarchy preservation */
  parentSpanId?: string;
  /** The parent observation ID for Langfuse hierarchy (stored for cross-process recovery) */
  parentObservationId?: string;
  /** W3C traceparent for OTel context propagation */
  traceparent?: string;
  /** Original tool context for cross-process restoration */
  ctx?: ToolContext;
  /** Parent tool use ID if this is a nested tool/subagent */
  parent_tool_use_id?: string;
}

/**
 * Git repository context.
 */
export interface GitContext {
  /** Whether we're in a git repository */
  isGitRepo: boolean;
  /** Current branch name */
  branch?: string;
  /** Remote origin URL */
  remoteUrl?: string;
  /** Repository name (extracted from remote URL or directory name) */
  repoName?: string;
  /** Current commit SHA (short) */
  commitSha?: string;
  /** Whether there are uncommitted changes */
  isDirty?: boolean;
}

/**
 * Context for the current Claude Code session.
 */
export interface SessionContext {
  /** Unique session identifier */
  sessionId: string;
  /** Optional user identifier */
  userId?: string;
  /** Current working directory */
  cwd: string;
  /** Permission mode for tool execution */
  permissionMode?: string;
  /** Git repository context */
  git?: GitContext;
}

/**
 * Context for a tool invocation.
 */
export interface ToolContext {
  /** Name of the tool being invoked */
  toolName: string;
  /** Unique identifier for this tool use */
  toolUseId: string;
  /** Input provided to the tool */
  toolInput: unknown;
  /** Whether this tool is a subagent (Task tool) */
  isSubagent: boolean;
  /** Type of subagent if applicable */
  subagentType?: string;
  /** Description of the subagent task */
  subagentDescription?: string;
  /** Model used by the subagent */
  subagentModel?: string;
  /** Model that executed this tool call (e.g., "claude-sonnet-4-20250514") */
  model?: string;
}

/**
 * Result of analyzing a tool response.
 */
export interface ToolResult {
  /** Whether the tool execution succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Type of error */
  errorType?: string;
  /** Exit code for command-like tools */
  exitCode?: number;
  /** Output from the tool */
  output?: unknown;
  /** Duration in milliseconds */
  durationMs?: number;
}

/**
 * Options for starting an observation.
 */
export interface StartObservationOptions {
  /** Parent trace ID for linking observations */
  parentTraceId?: string;
  /** Parent span ID for nesting */
  parentSpanId?: string;
  /** Custom start time (Date object) */
  startTime?: Date;
}

/**
 * Configuration for the tracing provider.
 */
export interface TracingConfig {
  /** Langfuse public key */
  publicKey: string;
  /** Langfuse secret key */
  secretKey: string;
  /** Langfuse host URL */
  baseUrl?: string;
  /** Environment name */
  environment?: string;
  /** Release version */
  release?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Observation levels for Langfuse.
 */
export type ObservationLevel = 'DEBUG' | 'DEFAULT' | 'WARNING' | 'ERROR';

/**
 * Observation types supported by Langfuse.
 */
export type ObservationType = 'span' | 'generation' | 'event' | 'agent' | 'tool';

/**
 * Token usage for a single operation.
 */
export interface TokenUsage {
  /** Input tokens consumed */
  input?: number;
  /** Output tokens generated */
  output?: number;
  /** Total tokens (input + output) */
  total?: number;
}

/**
 * Context for tracking tool chain information (for cascade failure detection).
 */
export interface ToolChainContext {
  /** Position of this tool in the execution chain (1-based) */
  position: number;
  /** Name of the preceding tool (if any) */
  precedingTool?: string;
  /** Whether the preceding tool succeeded (if any) */
  precedingSuccess?: boolean;
  /** Whether this is a retry of a previously failed tool */
  isRetry?: boolean;
  /** Number of times this tool has been retried */
  retryCount?: number;
}

/**
 * Tool chain state tracked per session.
 */
export interface ToolChainState {
  /** Current position in the tool chain */
  chainPosition: number;
  /** Name of the last completed tool */
  lastToolName?: string;
  /** Whether the last tool succeeded */
  lastToolSuccess?: boolean;
}

/**
 * Metrics tracked for a session.
 * Used for aggregating performance and error data across tool executions.
 */
export interface SessionMetrics {
  /** Total number of tools executed */
  toolCount: number;
  /** Number of Task (subagent) tools executed */
  subagentCount: number;
  /** Number of failed tool calls */
  errorCount: number;
  /** Sum of all tool durations in milliseconds */
  totalDurationMs: number;
  /** Individual tool durations for calculating min/max/avg */
  toolDurations: number[];
  /** Error counts by error type */
  errorsByType: Record<string, number>;
  /** Tool execution counts by tool name */
  toolsByName: Record<string, number>;
  /** Total input tokens consumed */
  totalInputTokens: number;
  /** Total output tokens generated */
  totalOutputTokens: number;
  /** Token usage by tool name */
  tokensByTool: Record<string, TokenUsage>;
  /** Tool execution counts by model */
  toolsByModel: Record<string, number>;
  /** Models used during the session (for quick lookup) */
  modelsUsed: string[];
}
