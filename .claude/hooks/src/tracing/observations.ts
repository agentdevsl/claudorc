/**
 * Observation factory functions for creating Langfuse observations.
 * Uses the v4 SDK with asType support for proper observation types (agent, tool, generation).
 */

import {
  startObservation,
  type LangfuseSpan,
  type LangfuseAgent,
  type LangfuseTool,
  type LangfuseGeneration,
} from '@langfuse/tracing';
import { context, trace, SpanContext, TraceFlags, ROOT_CONTEXT } from '@opentelemetry/api';
import type {
  SessionContext,
  ToolContext,
  ToolResult,
  SessionMetrics,
  ObservationLevel,
  TokenUsage,
} from './types.js';
import { createHash } from 'crypto';

/**
 * Create a W3C traceparent string from trace and span IDs.
 * Format: {version}-{trace-id}-{span-id}-{flags}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 *
 * @param traceId - 32 hex character trace ID
 * @param spanId - 16 hex character span ID
 * @returns W3C traceparent string
 */
export function createTraceparent(traceId: string, spanId: string): string {
  // Ensure traceId is 32 chars and spanId is 16 chars
  const normalizedTraceId = traceId.padStart(32, '0').substring(0, 32);
  const normalizedSpanId = spanId.padStart(16, '0').substring(0, 16);
  return `00-${normalizedTraceId}-${normalizedSpanId}-01`;
}

/**
 * Parse a W3C traceparent string into its components.
 *
 * @param traceparent - W3C traceparent string
 * @returns Parsed components or null if invalid
 */
export function parseTraceparent(
  traceparent: string
): { traceId: string; spanId: string; traceFlags: number } | null {
  const match = traceparent.match(/^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i);
  if (!match) return null;
  return {
    traceId: match[1],
    spanId: match[2],
    traceFlags: parseInt(match[3], 16),
  };
}

/**
 * Create an OTel SpanContext from a traceparent string.
 *
 * @param traceparent - W3C traceparent string
 * @returns SpanContext or null if invalid
 */
export function spanContextFromTraceparent(traceparent: string): SpanContext | null {
  const parsed = parseTraceparent(traceparent);
  if (!parsed) return null;
  return {
    traceId: parsed.traceId,
    spanId: parsed.spanId,
    traceFlags: parsed.traceFlags as TraceFlags,
    isRemote: true,
  };
}

/**
 * Execute a function within the context of a parent span.
 * This enables cross-process span linking by restoring OTel context.
 *
 * @param traceparent - W3C traceparent string
 * @param fn - Function to execute within the context
 * @returns The result of the function
 */
export function withParentContext<T>(traceparent: string, fn: () => T): T {
  const spanContext = spanContextFromTraceparent(traceparent);
  if (!spanContext) {
    // Invalid traceparent, execute without context
    return fn();
  }

  // Create a context with the parent span
  const parentContext = trace.setSpanContext(ROOT_CONTEXT, spanContext);

  // Execute the function within the parent context
  return context.with(parentContext, fn);
}

// Type for any observation that can be a parent
type AnyObservation = LangfuseSpan | LangfuseAgent | LangfuseTool | LangfuseGeneration;

/**
 * Wrapper for session (trace-level) observation.
 * Uses the v4 SDK span as the root observation for a session.
 */
export interface SessionObservation {
  /** The trace ID */
  traceId: string;
  /** The root observation ID */
  id: string;
  /** Update trace metadata */
  updateTrace(params: {
    name?: string;
    sessionId?: string;
    userId?: string;
    tags?: string[];
  }): void;
  /** Update observation with output/metadata */
  update(params: {
    output?: unknown;
    level?: ObservationLevel;
    metadata?: Record<string, unknown>;
  }): void;
  /** End the observation */
  end(): void;
  /** Internal span reference */
  _span: LangfuseSpan;
}

/**
 * Wrapper for tool observation.
 * Uses asType to set proper observation type (agent, tool, generation).
 */
export interface ToolObservation {
  /** The trace ID this observation belongs to */
  traceId: string;
  /** The observation ID */
  id: string;
  /** The observation type (agent, tool, span) */
  observationType: 'agent' | 'tool' | 'span';
  /** Update observation with output/metadata */
  update(params: {
    output?: unknown;
    level?: ObservationLevel;
    statusMessage?: string;
    metadata?: Record<string, unknown>;
    /** Token usage (for agents/generations) */
    usage?: TokenUsage;
    /** Model name (for agents) */
    model?: string;
  }): void;
  /** End the observation */
  end(): void;
  /** Internal observation reference */
  _observation: AnyObservation;
}

/**
 * Options for creating observations.
 */
export interface CreateObservationOptions {
  /** Parent trace ID for linking */
  parentTraceId?: string;
  /** Parent span ID for nesting */
  parentSpanId?: string;
  /** Custom start time */
  startTime?: Date;
}

/**
 * Create a deterministic trace ID from a session ID.
 * This allows linking observations across stateless processes.
 *
 * @param sessionId - The session identifier
 * @returns A deterministic trace ID (32 hex chars)
 */
export function createSessionTraceId(sessionId: string): string {
  const hash = createHash('sha256').update(sessionId).digest('hex');
  return hash.substring(0, 32);
}

/**
 * Create a session-level observation.
 * Sessions are tracked as root spans in Langfuse v4.
 *
 * @param ctx - Session context
 * @param options - Optional creation settings
 * @returns A SessionObservation wrapper
 */
export function createSessionObservation(
  ctx: SessionContext,
  _options?: CreateObservationOptions
): SessionObservation {
  // Build input with optional git context
  const input: Record<string, unknown> = {
    cwd: ctx.cwd,
    permission_mode: ctx.permissionMode,
  };

  if (ctx.git?.isGitRepo) {
    input.git = {
      repo: ctx.git.repoName,
      branch: ctx.git.branch,
      commit: ctx.git.commitSha,
      is_dirty: ctx.git.isDirty,
    };
  }

  // Build metadata
  const metadata: Record<string, unknown> = {
    session_id: ctx.sessionId,
    user_id: ctx.userId || 'unknown',
  };

  if (ctx.git?.isGitRepo) {
    metadata.git_repo = ctx.git.repoName;
    metadata.git_branch = ctx.git.branch;
    metadata.git_commit = ctx.git.commitSha;
  }

  // Create root span using v4 SDK
  const span = startObservation('claude-code-session', {
    input,
    metadata,
  });

  // Set trace-level attributes (sessionId, userId)
  span.updateTrace({
    sessionId: ctx.sessionId,
    userId: ctx.userId || 'unknown',
  });

  return {
    traceId: span.traceId,
    id: span.id,
    _span: span,
    updateTrace(params) {
      span.update({
        metadata: {
          ...metadata,
          name: params.name,
          tags: params.tags,
        },
      });
    },
    update(params) {
      span.update({
        output: params.output,
        metadata: params.metadata,
        level: params.level,
      });
    },
    end() {
      span.end();
    },
  };
}

/**
 * Create a session-level observation linked to a parent trace.
 * Used for subagent sessions to link them to the parent's trace hierarchy.
 *
 * @param ctx - Session context
 * @param traceparent - W3C traceparent string for linking to parent trace
 * @param parentContext - Additional parent context for metadata
 * @returns A SessionObservation wrapper linked to the parent trace
 */
export function createSessionObservationWithParent(
  ctx: SessionContext,
  traceparent: string,
  parentContext?: {
    parentSessionId?: string;
    parentObservationId?: string;
    subagentType?: string;
  }
): SessionObservation {
  // Build input with optional git context
  const input: Record<string, unknown> = {
    cwd: ctx.cwd,
    permission_mode: ctx.permissionMode,
  };

  if (ctx.git?.isGitRepo) {
    input.git = {
      repo: ctx.git.repoName,
      branch: ctx.git.branch,
      commit: ctx.git.commitSha,
      is_dirty: ctx.git.isDirty,
    };
  }

  // Build metadata with parent linking info
  const metadata: Record<string, unknown> = {
    session_id: ctx.sessionId,
    user_id: ctx.userId || 'unknown',
    is_subagent: true, // Mark as subagent session
  };

  if (ctx.git?.isGitRepo) {
    metadata.git_repo = ctx.git.repoName;
    metadata.git_branch = ctx.git.branch;
    metadata.git_commit = ctx.git.commitSha;
  }

  // Add parent context metadata for hierarchy visualization
  if (parentContext) {
    if (parentContext.parentSessionId) {
      metadata.parent_session_id = parentContext.parentSessionId;
    }
    if (parentContext.parentObservationId) {
      metadata.parent_observation_id = parentContext.parentObservationId;
    }
    if (parentContext.subagentType) {
      metadata.subagent_type = parentContext.subagentType;
    }
  }

  // Parse traceparent to get parent span context for cross-process linking
  const parsedParent = parseTraceparent(traceparent);
  const parentSpanContext = parsedParent
    ? {
        traceId: parsedParent.traceId,
        spanId: parsedParent.spanId,
        traceFlags: parsedParent.traceFlags as TraceFlags,
        isRemote: true,
      }
    : undefined;

  // Create root span with parent span context for proper trace linking
  const span = startObservation(
    'claude-code-subagent-session',
    {
      input,
      metadata,
    },
    {
      parentSpanContext,
    }
  );

  // Set trace-level attributes (sessionId, userId)
  span.updateTrace({
    sessionId: ctx.sessionId,
    userId: ctx.userId || 'unknown',
  });

  return {
    traceId: span.traceId,
    id: span.id,
    _span: span,
    updateTrace(params) {
      span.update({
        metadata: {
          ...metadata,
          name: params.name,
          tags: params.tags,
        },
      });
    },
    update(params) {
      span.update({
        output: params.output,
        metadata: params.metadata,
        level: params.level,
      });
    },
    end() {
      span.end();
    },
  };
}

/**
 * Create a tool-level observation using v4 SDK with asType.
 * - Subagents (Task tool) use asType: "agent"
 * - Regular tools use asType: "tool"
 *
 * @param ctx - Tool context
 * @param options - Optional creation settings (including parent observation)
 * @param parentObservation - Optional parent observation for hierarchy
 * @returns A ToolObservation wrapper
 */
export function createToolObservation(
  ctx: ToolContext,
  _options?: CreateObservationOptions,
  parentObservation?: SessionObservation | ToolObservation
): ToolObservation {
  const metadata: Record<string, unknown> = {
    tool_name: ctx.toolName,
    tool_use_id: ctx.toolUseId,
  };

  // Subagents get "agent" type for proper hierarchy visualization
  if (ctx.isSubagent) {
    const agentName = ctx.subagentType ? `Agent:${ctx.subagentType}` : `Agent:${ctx.toolName}`;

    if (ctx.subagentType) metadata.subagent_type = ctx.subagentType;
    if (ctx.subagentDescription) metadata.description = ctx.subagentDescription;
    if (ctx.subagentModel) metadata.model = ctx.subagentModel;

    // Create agent observation - either as child or root
    let observation: LangfuseAgent;
    if (parentObservation) {
      // Create as child of parent
      const parent =
        '_span' in parentObservation ? parentObservation._span : parentObservation._observation;
      observation = parent.startObservation(
        agentName,
        {
          input: ctx.toolInput,
          metadata,
        },
        { asType: 'agent' }
      );
    } else {
      // Create as root observation
      observation = startObservation(
        agentName,
        {
          input: ctx.toolInput,
          metadata,
        },
        { asType: 'agent' }
      );
    }

    return {
      traceId: observation.traceId,
      id: observation.id,
      observationType: 'agent',
      _observation: observation,
      update(params) {
        observation.update({
          output: params.output,
          level: params.level,
          statusMessage: params.statusMessage,
          metadata: params.metadata,
        });
      },
      end() {
        observation.end();
      },
    };
  }

  // Regular tools get "tool" type
  const toolName = ctx.toolName;

  if (ctx.model) {
    metadata.model = ctx.model;
  }

  // Create tool observation - either as child or root
  let observation: LangfuseTool;
  if (parentObservation) {
    // Create as child of parent
    const parent =
      '_span' in parentObservation ? parentObservation._span : parentObservation._observation;
    observation = parent.startObservation(
      toolName,
      {
        input: ctx.toolInput,
        metadata,
      },
      { asType: 'tool' }
    );
  } else {
    // Create as root observation
    observation = startObservation(
      toolName,
      {
        input: ctx.toolInput,
        metadata,
      },
      { asType: 'tool' }
    );
  }

  return {
    traceId: observation.traceId,
    id: observation.id,
    observationType: 'tool',
    _observation: observation,
    update(params) {
      observation.update({
        output: params.output,
        level: params.level,
        statusMessage: params.statusMessage,
        metadata: params.metadata,
      });
    },
    end() {
      observation.end();
    },
  };
}

/**
 * Create a tool observation within a restored parent context.
 * Used for cross-process scenarios where we need to attach to an existing trace.
 *
 * @param ctx - Tool context
 * @param traceparent - W3C traceparent string for context restoration
 * @param sessionId - Optional session ID to set on the trace (for cross-process sessions)
 * @param parentObservationId - Optional parent observation ID for Langfuse hierarchy metadata
 * @returns A ToolObservation wrapper attached to the parent trace
 */
export function createToolObservationWithContext(
  ctx: ToolContext,
  traceparent: string,
  sessionId?: string,
  parentObservationId?: string
): ToolObservation {
  // Parse traceparent to get parent span context for cross-process linking
  const parsedParent = parseTraceparent(traceparent);
  const parentSpanContext = parsedParent
    ? {
        traceId: parsedParent.traceId,
        spanId: parsedParent.spanId,
        traceFlags: parsedParent.traceFlags as TraceFlags,
        isRemote: true,
      }
    : undefined;

  const metadata: Record<string, unknown> = {
    tool_name: ctx.toolName,
    tool_use_id: ctx.toolUseId,
    cross_process: true, // Mark as cross-process for debugging
  };

  // Add parent observation ID to metadata for Langfuse hierarchy debugging
  // Note: The OTel parentSpanContext handles trace linking, but parentObservationId
  // is stored in metadata for visibility since SDK v4 doesn't support native parentObservationId
  if (parentObservationId) {
    metadata.parent_observation_id = parentObservationId;
  }
  // Also extract parent span ID from traceparent as fallback for hierarchy tracking
  if (parsedParent) {
    metadata.parent_span_id = parsedParent.spanId;
  }

  // Subagents get "agent" type for proper hierarchy visualization
  if (ctx.isSubagent) {
    const agentName = ctx.subagentType ? `Agent:${ctx.subagentType}` : `Agent:${ctx.toolName}`;

    if (ctx.subagentType) metadata.subagent_type = ctx.subagentType;
    if (ctx.subagentDescription) metadata.description = ctx.subagentDescription;
    if (ctx.subagentModel) metadata.model = ctx.subagentModel;

    // Create agent observation with parent span context for proper trace linking
    const observation: LangfuseAgent = startObservation(
      agentName,
      {
        input: ctx.toolInput,
        metadata,
      },
      { asType: 'agent', parentSpanContext }
    );

    // Set sessionId and name on trace for cross-process session correlation
    if (sessionId) {
      observation.updateTrace({
        sessionId,
        name: 'claude-code-session',
      });
    }

    return {
      traceId: observation.traceId,
      id: observation.id,
      observationType: 'agent' as const,
      _observation: observation,
      update(params: {
        output?: unknown;
        level?: ObservationLevel;
        statusMessage?: string;
        metadata?: Record<string, unknown>;
        usage?: TokenUsage;
        model?: string;
      }) {
        observation.update({
          output: params.output,
          level: params.level,
          statusMessage: params.statusMessage,
          metadata: params.metadata,
        });
      },
      end() {
        observation.end();
      },
    };
  }

  // Regular tools get "tool" type
  if (ctx.model) {
    metadata.model = ctx.model;
  }

  // Create tool observation with parent span context for proper trace linking
  const observation: LangfuseTool = startObservation(
    ctx.toolName,
    {
      input: ctx.toolInput,
      metadata,
    },
    { asType: 'tool', parentSpanContext }
  );

  // Set sessionId and name on trace for cross-process session correlation
  if (sessionId) {
    observation.updateTrace({
      sessionId,
      name: 'claude-code-session',
    });
  }

  return {
    traceId: observation.traceId,
    id: observation.id,
    observationType: 'tool' as const,
    _observation: observation,
    update(params: {
      output?: unknown;
      level?: ObservationLevel;
      statusMessage?: string;
      metadata?: Record<string, unknown>;
      usage?: TokenUsage;
      model?: string;
    }) {
      observation.update({
        output: params.output,
        level: params.level,
        statusMessage: params.statusMessage,
        metadata: params.metadata,
      });
    },
    end() {
      observation.end();
    },
  };
}

/**
 * Create an event observation for point-in-time occurrences.
 * In v4 SDK, events are created using startObservation with asType: "event".
 *
 * @param name - Event name
 * @param input - Event input (e.g., user prompt content)
 * @param metadata - Event metadata
 * @param parentObservation - Optional parent observation
 */
export function createEventObservation(
  name: string,
  input?: unknown,
  metadata?: Record<string, unknown>,
  parentObservation?: SessionObservation | ToolObservation
): void {
  const eventMetadata = {
    ...metadata,
    timestamp: new Date().toISOString(),
  };

  if (parentObservation) {
    const parent =
      '_span' in parentObservation ? parentObservation._span : parentObservation._observation;
    // Events auto-end in v4 SDK
    parent.startObservation(
      name,
      {
        input,
        metadata: eventMetadata,
      },
      { asType: 'event' }
    );
  } else {
    // Create as root event
    startObservation(
      name,
      {
        input,
        metadata: eventMetadata,
      },
      { asType: 'event' }
    );
  }
}

/**
 * Record an event (create and immediately finalize).
 *
 * @param name - Event name
 * @param input - Event input (e.g., user prompt content)
 * @param metadata - Event metadata
 * @param parentObservation - Optional parent observation
 */
export function recordEvent(
  name: string,
  input?: unknown,
  metadata?: Record<string, unknown>,
  parentObservation?: SessionObservation | ToolObservation
): void {
  createEventObservation(name, input, metadata, parentObservation);
}

/**
 * Parameters for upserting an observation in PostToolUse (cross-process).
 */
export interface UpsertObservationParams {
  /** The observation ID to upsert (same ID = update, not create) */
  id: string;
  /** The trace ID for this observation */
  traceId: string;
  /** Observation name */
  name: string;
  /** Start time of the observation */
  startTime: Date;
  /** End time of the observation */
  endTime: Date;
  /** Output data */
  output?: unknown;
  /** Observation level */
  level?: ObservationLevel;
  /** Error message if failed */
  statusMessage?: string;
  /** Metadata including success, duration, tokens, etc. */
  metadata?: Record<string, unknown>;
  /** Session ID for trace linking */
  sessionId?: string;
  /** Parent span context for hierarchy */
  parentSpanContext?: SpanContext;
  /** Observation type: agent or tool */
  observationType?: 'agent' | 'tool';
  /** Parent observation ID for Langfuse hierarchy metadata */
  parentObservationId?: string;
  /** Token usage details for Langfuse cost tracking */
  usageDetails?: Record<string, number>;
}

/**
 * Upsert a tool observation in PostToolUse for cross-process scenarios.
 *
 * Strategy: Since Langfuse SDK v4's startObservation doesn't support custom IDs,
 * we create a NEW observation that includes all the data from both PreToolUse and PostToolUse.
 * The key insight is that the PreToolUse observation was already created and ended in that process,
 * so here we just need to create the final observation with complete data.
 *
 * To prevent duplicates, the PreToolUse handler should NOT end() the observation - it should
 * leave it "open" for the PostToolUse handler to finalize. However, since we're in different
 * processes, the observation object from PreToolUse is lost.
 *
 * For now, we create a complete observation in PostToolUse with all the data marked as
 * cross_process_completion. The PreToolUse observation will remain as a "started" event and
 * this PostToolUse observation will be the "completed" event with full result data.
 *
 * @param params - Upsert parameters including the observation ID from PreToolUse
 * @returns The created ToolObservation wrapper
 */
export function upsertToolObservation(params: UpsertObservationParams): ToolObservation {
  const {
    id,
    traceId,
    name,
    startTime,
    endTime,
    output,
    level,
    statusMessage,
    metadata,
    sessionId,
    parentSpanContext,
    observationType = 'tool',
    parentObservationId,
    usageDetails,
  } = params;

  // Build complete metadata with cross-process completion marker
  const fullMetadata: Record<string, unknown> = {
    ...metadata,
    cross_process_completion: true,
    original_observation_id: id, // Link to the PreToolUse observation for correlation
    start_time_iso: startTime.toISOString(),
    end_time_iso: endTime.toISOString(),
    duration_ms: endTime.getTime() - startTime.getTime(),
  };

  // Add parent observation ID to metadata for Langfuse hierarchy debugging
  if (parentObservationId) {
    fullMetadata.parent_observation_id = parentObservationId;
  }
  // Also include parent span ID from span context for consistency
  if (parentSpanContext) {
    fullMetadata.parent_span_id = parentSpanContext.spanId;
  }

  // Create a new observation with parent context for proper linking
  // Use the original name (not `:result` suffix) to avoid duplicate-looking entries
  // The cross_process_completion metadata marker distinguishes this as the final observation
  // Note: We use type assertion to satisfy TypeScript while the runtime supports "agent"/"tool"
  const observation =
    observationType === 'agent'
      ? startObservation(
          name,
          {
            output,
            metadata: fullMetadata,
            level,
            statusMessage,
          },
          {
            asType: 'agent' as const,
            parentSpanContext,
          }
        )
      : startObservation(
          name,
          {
            output,
            metadata: fullMetadata,
            level,
            statusMessage,
          },
          {
            asType: 'tool' as const,
            parentSpanContext,
          }
        );

  // Update trace with sessionId for cross-process correlation
  if (sessionId) {
    observation.updateTrace({
      sessionId,
      name: 'claude-code-session',
    });
  }

  // If we have usage details, set them directly on the OTel span
  // This bypasses the TypeScript type limitation for agent/tool observations
  if (usageDetails) {
    const obs = observation as unknown as {
      updateOtelSpanAttributes?: (attrs: Record<string, unknown>) => void;
    };
    if (typeof obs.updateOtelSpanAttributes === 'function') {
      obs.updateOtelSpanAttributes({ usageDetails });
    }
  }

  // End the observation immediately (we're finalizing it)
  observation.end();

  return {
    traceId: observation.traceId || traceId,
    id: observation.id,
    observationType,
    _observation: observation,
    update(updateParams) {
      observation.update({
        output: updateParams.output,
        level: updateParams.level,
        statusMessage: updateParams.statusMessage,
        metadata: updateParams.metadata,
      });
    },
    end() {
      // Already ended above
    },
  };
}

/**
 * Record an event within a restored parent context (cross-process).
 * Uses W3C traceparent to link the event to the correct trace.
 *
 * @param name - Event name
 * @param input - Event input (e.g., user prompt content)
 * @param metadata - Event metadata
 * @param traceparent - W3C traceparent string for context restoration
 * @param sessionId - Optional session ID to set on the trace (for cross-process sessions)
 * @param parentObservationId - Optional parent observation ID for Langfuse hierarchy metadata
 */
export function recordEventWithContext(
  name: string,
  input?: unknown,
  metadata?: Record<string, unknown>,
  traceparent?: string,
  sessionId?: string,
  parentObservationId?: string
): void {
  if (!traceparent) {
    // No traceparent - create as root event (fallback)
    createEventObservation(name, input, metadata);
    return;
  }

  // Parse traceparent to get parent span context for cross-process linking
  const parsedParent = parseTraceparent(traceparent);
  const parentSpanContext = parsedParent
    ? {
        traceId: parsedParent.traceId,
        spanId: parsedParent.spanId,
        traceFlags: parsedParent.traceFlags as TraceFlags,
        isRemote: true,
      }
    : undefined;

  const eventMetadata: Record<string, unknown> = {
    ...metadata,
    timestamp: new Date().toISOString(),
    cross_process: true,
  };

  // Add parent observation ID to metadata for Langfuse hierarchy debugging
  if (parentObservationId) {
    eventMetadata.parent_observation_id = parentObservationId;
  }
  // Also extract parent span ID from traceparent for hierarchy tracking
  if (parsedParent) {
    eventMetadata.parent_span_id = parsedParent.spanId;
  }

  // Create event with parent span context for proper trace linking
  const observation = startObservation(
    name,
    {
      input,
      metadata: eventMetadata,
    },
    { asType: 'event', parentSpanContext }
  );

  // Ensure trace has sessionId and name for cross-process events
  if (sessionId) {
    observation.updateTrace({
      sessionId,
      name: 'claude-code-session',
    });
  }
}

/**
 * Format a status message for display in Langfuse UI.
 * Provides a concise, informative message about tool execution status.
 *
 * @param result - The tool result
 * @param toolName - The tool name
 * @returns Formatted status message
 */
export function formatStatusMessage(result: ToolResult, toolName?: string): string | undefined {
  if (result.success) {
    // Don't set statusMessage for successful tools (cleaner UI)
    return undefined;
  }

  const parts: string[] = [];

  // Add error type badge
  if (result.errorType) {
    parts.push(`[${result.errorType.toUpperCase()}]`);
  }

  // Add tool name for context
  if (toolName) {
    parts.push(toolName);
  }

  // Add specific error info
  if (result.exitCode !== undefined && result.exitCode !== 0) {
    parts.push(`exit=${result.exitCode}`);
  }
  if (result.durationMs !== undefined && result.durationMs > 30000) {
    parts.push(`duration=${Math.round(result.durationMs / 1000)}s`);
  }

  // Add error message (truncated)
  if (result.error) {
    const maxLen = 100;
    const truncated =
      result.error.length > maxLen ? result.error.substring(0, maxLen) + '...' : result.error;
    parts.push(`- ${truncated}`);
  }

  return parts.length > 0 ? parts.join(' ') : undefined;
}

/**
 * Update a tool observation with its result.
 *
 * @param observation - The observation to update
 * @param result - The tool result
 * @param ctx - Optional additional context
 * @param tokens - Optional token usage
 */
export function finalizeToolObservation(
  observation: ToolObservation,
  result: ToolResult,
  ctx?: Partial<ToolContext>,
  tokens?: TokenUsage
): void {
  const level: ObservationLevel = result.success ? 'DEFAULT' : 'ERROR';

  const metadata: Record<string, unknown> = {
    success: result.success,
  };

  if (result.durationMs !== undefined) {
    metadata.duration_ms = result.durationMs;
  }
  if (result.error) {
    metadata.error = result.error;
  }
  if (result.errorType) {
    metadata.error_type = result.errorType;
  }
  if (result.exitCode !== undefined) {
    metadata.exit_code = result.exitCode;
  }

  // Add subagent context if provided
  if (ctx?.isSubagent) {
    if (ctx.subagentType) metadata.subagent_type = ctx.subagentType;
    if (ctx.subagentDescription) metadata.subagent_description = ctx.subagentDescription;
    if (ctx.subagentModel) metadata.subagent_model = ctx.subagentModel;
  }

  // Build usageDetails for Langfuse if tokens are available
  // Note: While TypeScript types for agent/tool don't include usageDetails,
  // the underlying OTel implementation DOES support it via OBSERVATION_USAGE_DETAILS attribute.
  // We pass usageDetails through the internal observation's updateOtelSpanAttributes method.
  let usageDetails: Record<string, number> | undefined;
  if (tokens && (tokens.input || tokens.output || tokens.total)) {
    usageDetails = {
      input: tokens.input ?? 0,
      output: tokens.output ?? 0,
      total: tokens.total ?? (tokens.input ?? 0) + (tokens.output ?? 0),
    };
    // Also store in metadata for visibility as backup
    metadata.token_usage = {
      input_tokens: usageDetails.input,
      output_tokens: usageDetails.output,
      total_tokens: usageDetails.total,
    };
  }

  // Update the observation with result data
  // Use formatted status message for better UI visibility
  const statusMessage = formatStatusMessage(result, ctx?.toolName);

  observation.update({
    output: result.output,
    level,
    statusMessage,
    metadata,
  });

  // If we have usage details, set them directly on the OTel span
  // This bypasses the TypeScript type limitation for agent/tool observations
  if (usageDetails && observation._observation) {
    const obs = observation._observation as unknown as {
      updateOtelSpanAttributes?: (attrs: Record<string, unknown>) => void;
    };
    if (typeof obs.updateOtelSpanAttributes === 'function') {
      obs.updateOtelSpanAttributes({ usageDetails });
    }
  }

  observation.end();
}

/**
 * Options for finalizing a session observation.
 */
export interface FinalizeSessionOptions {
  /** Whether the session ended normally */
  ended?: boolean;
  /** Timestamp of session end */
  timestamp?: string;
  /** Session metrics to include in output */
  metrics?: SessionMetrics;
  /** Aggregate metrics (avg, min, max durations, token usage, model breakdown) */
  aggregateMetrics?: {
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
  };
}

/**
 * Finalize a session observation.
 *
 * @param observation - The session observation to finalize
 * @param options - Optional finalization options including metrics
 */
export function finalizeSessionObservation(
  observation: SessionObservation,
  options?: FinalizeSessionOptions
): void {
  const output: Record<string, unknown> = {
    ended: options?.ended ?? true,
    timestamp: options?.timestamp ?? new Date().toISOString(),
  };

  // Include session metrics if provided
  if (options?.metrics) {
    output.metrics = {
      tool_count: options.metrics.toolCount,
      subagent_count: options.metrics.subagentCount,
      error_count: options.metrics.errorCount,
      total_duration_ms: options.metrics.totalDurationMs,
    };
  }

  // Include aggregate metrics if provided
  if (options?.aggregateMetrics) {
    output.performance = {
      avg_duration_ms: options.aggregateMetrics.avgDurationMs,
      min_duration_ms: options.aggregateMetrics.minDurationMs,
      max_duration_ms: options.aggregateMetrics.maxDurationMs,
      tool_breakdown: options.aggregateMetrics.toolBreakdown,
      error_breakdown: options.aggregateMetrics.errorBreakdown,
    };

    // Include token usage if any tokens were tracked
    if (options.aggregateMetrics.totalTokens > 0) {
      output.token_usage = {
        total_input_tokens: options.aggregateMetrics.totalInputTokens,
        total_output_tokens: options.aggregateMetrics.totalOutputTokens,
        total_tokens: options.aggregateMetrics.totalTokens,
        tokens_by_tool: options.aggregateMetrics.tokensByTool,
      };
    }

    // Include model usage if any models were tracked
    if (options.aggregateMetrics.modelsUsed.length > 0) {
      output.model_usage = {
        models_used: options.aggregateMetrics.modelsUsed,
        model_breakdown: options.aggregateMetrics.modelBreakdown,
      };
    }
  }

  // Add end timestamp to metadata
  const metadata: Record<string, unknown> = {
    end_timestamp: new Date().toISOString(),
  };

  observation.update({
    output,
    metadata,
  });

  observation.end();
}

/**
 * Create parent context info for observation options.
 * This is a helper to build CreateObservationOptions from trace/span IDs.
 */
export function createParentContext(traceId: string, spanId?: string): CreateObservationOptions {
  return {
    parentTraceId: traceId,
    parentSpanId: spanId,
  };
}
