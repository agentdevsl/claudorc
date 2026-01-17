#!/usr/bin/env node
import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

// Check enable flag BEFORE loading .env (so CLI can override)
const __dirname = dirname(fileURLToPath(import.meta.url));
const enabledFromEnv = process.env.LANGFUSE_HOOK_ENABLED;

// Load .env from the hooks directory (not CWD) - don't override existing env vars
// Note: dotenv v17 doesn't reliably inject all values into process.env, so we manually assign
const dotenvResult = config({ path: join(__dirname, '..', '.env') });
if (dotenvResult.parsed) {
  // Only assign values that aren't already set (preserve existing env vars)
  // Check for both undefined and empty string since dotenv v17 may set empty strings
  // Special case: URL values (LANGFUSE_HOST/LANGFUSE_BASE_URL) should be validated and
  // overwritten if they appear malformed (missing :// indicates truncation)
  for (const [key, value] of Object.entries(dotenvResult.parsed)) {
    const existingValue = process.env[key];
    const isUrlKey = key === 'LANGFUSE_HOST' || key === 'LANGFUSE_BASE_URL';
    const isMalformedUrl = isUrlKey && existingValue && !existingValue.includes('://');

    if (!existingValue || isMalformedUrl) {
      process.env[key] = value;
    }
  }
}

// Early exit if hook is not enabled (check original env value or loaded value)
const HOOK_ENABLED =
  (enabledFromEnv ?? process.env.LANGFUSE_HOOK_ENABLED) === 'true' ||
  (enabledFromEnv ?? process.env.LANGFUSE_HOOK_ENABLED) === '1';
if (!HOOK_ENABLED) {
  process.exit(0);
}

// File-based debug logging (always enabled to diagnose hook invocation)
const DEBUG_LOG_FILE = '/tmp/langfuse-hook-debug.log';
const debugLog = (msg: string): void => {
  const timestamp = new Date().toISOString();
  try {
    appendFileSync(DEBUG_LOG_FILE, `[${timestamp}] ${msg}\n`);
  } catch {
    // Ignore write errors
  }
};

// Log hook startup immediately
debugLog(`Hook started - PID: ${process.pid}, CWD: ${process.cwd()}, __dirname: ${__dirname}`);

import { createInterface } from 'node:readline';
import {
  calculateAggregateMetrics,
  cleanupOldStates,
  cleanupPendingParentContexts,
  cleanupProcessedEvents,
  createConfigFromEnv,
  // Event deduplication for cross-process duplicate prevention
  createEventFingerprint,
  createSessionObservation,
  createSessionObservationWithParent,
  createToolObservation,
  createToolObservationWithContext,
  createTraceparent,
  deleteSpanState,
  finalizeSessionObservation,
  finalizeToolObservation,
  // Extended function for SubagentStop cleanup (moved from PostToolUse)
  findAndRemovePendingParentContextBySession,
  findPendingParentContext,
  flushScores,
  forceFlush,
  // Status message formatting
  formatStatusMessage,
  // Score recording for failure tracking
  getLangfuseClient,
  getSessionInfo,
  getSessionMetrics,
  // Tool chain state for cascade failure detection
  getToolChainContext,
  hasProcessedEvent,
  initSession,
  initTracing,
  markEventProcessed,
  type PendingParentContext,
  parseTraceparent,
  popActiveSpan,
  recordEvent,
  recordEventWithContext,
  recordSessionHealthScores,
  recordToolFailureScores,
  recordToolSuccessScores,
  // Persistence functions for cross-process span linking
  registerActiveSpan,
  // Types
  type SessionObservation,
  shutdownTracing,
  // Pending parent context for subagent linking
  storePendingParentContext,
  type ToolChainContext,
  type ToolContext,
  type ToolObservation,
  type ToolResult,
  // Metrics tracking functions
  updateSessionMetrics,
  updateToolChainState,
  // Cross-process upsert for duplicate prevention
  upsertToolObservation,
} from './tracing/index.js';
import {
  analyzeToolResult,
  type ClaudeCodeEvent,
  getGitContext,
  getSubagentInfo,
  getSubagentStopInfo,
  isSubagentTool,
  isValidEvent,
} from './utils.js';

/**
 * Claude Code Langfuse Hook (Native SDK)
 * - Uses native Langfuse SDK for clean output without OTel metadata
 * - Restores proper parent/child relationships for tools and subagents
 * - Persists full context for cross-process recovery
 * - Centralizes parent resolution
 */

// Configuration
const DEBUG = process.env.LANGFUSE_LOG_LEVEL === 'DEBUG';

const log = (level: string, msg: string): void =>
  console.error(`[Langfuse] ${level === 'ERROR' ? 'ERROR: ' : ''}${msg}`);

// Track active spans by tool_use_id
interface ActiveObservation {
  observation: ToolObservation;
  startTime: number;
  ctx: ToolContext;
  chainContext?: ToolChainContext;
}
const activeObservations = new Map<string, ActiveObservation>();

// Session observations by session_id
const sessionObservations = new Map<string, SessionObservation>();

// Process a single event
function processEvent(event: ClaudeCodeEvent): void {
  // Try to get existing session info from persistence first (cross-process scenario)
  let persistedSession = getSessionInfo(event.session_id);

  // Get or create session observation - only if no persisted session exists
  let sessionObs = sessionObservations.get(event.session_id);

  // If we have a persisted session without traceparent, add one
  if (persistedSession && !persistedSession.traceparent) {
    const newTraceparent = createTraceparent(
      persistedSession.traceId,
      persistedSession.sessionSpanId
    );
    initSession(
      event.session_id,
      persistedSession.traceId,
      persistedSession.sessionSpanId,
      newTraceparent
    );
    // Refresh persisted session
    persistedSession = getSessionInfo(event.session_id);
    DEBUG && log('DEBUG', `Added traceparent to existing session: ${newTraceparent}`);
  }

  if (!sessionObs && !persistedSession) {
    const gitContext = getGitContext(event.cwd);

    // Check if there's a pending parent context (this session might be a subagent)
    const pendingParent = findPendingParentContext();

    if (pendingParent) {
      // This is a subagent session - link it to the parent trace
      sessionObs = createSessionObservationWithParent(
        {
          sessionId: event.session_id,
          userId: event.user_id,
          cwd: event.cwd,
          permissionMode: event.permission_mode,
          git: gitContext,
        },
        pendingParent.traceparent,
        {
          parentSessionId: pendingParent.parentSessionId,
          parentObservationId: pendingParent.observationId,
          subagentType: pendingParent.subagentType,
        }
      );
      sessionObservations.set(event.session_id, sessionObs);

      const tags = ['claude-code', 'subagent'];
      if (gitContext.isGitRepo && gitContext.repoName) tags.push(`repo:${gitContext.repoName}`);
      if (gitContext.branch) tags.push(`branch:${gitContext.branch}`);
      if (pendingParent.subagentType) tags.push(`subagent:${pendingParent.subagentType}`);

      sessionObs.updateTrace({
        name: 'claude-code-subagent-session',
        sessionId: event.session_id,
        userId: event.user_id || 'unknown',
        tags,
      });

      // Create traceparent for cross-process context propagation
      const traceparent = createTraceparent(sessionObs.traceId, sessionObs.id);

      // persist session with traceparent for cross-process linking
      initSession(event.session_id, sessionObs.traceId, sessionObs.id, traceparent);

      log(
        'INFO',
        `Created subagent session: ${event.session_id} (linked to parent: ${pendingParent.parentSessionId})`
      );
    } else {
      // This is a top-level session
      sessionObs = createSessionObservation({
        sessionId: event.session_id,
        userId: event.user_id,
        cwd: event.cwd,
        permissionMode: event.permission_mode,
        git: gitContext,
      });
      sessionObservations.set(event.session_id, sessionObs);

      const tags = ['claude-code'];
      if (gitContext.isGitRepo && gitContext.repoName) tags.push(`repo:${gitContext.repoName}`);
      if (gitContext.branch) tags.push(`branch:${gitContext.branch}`);

      sessionObs.updateTrace({
        name: 'claude-code-session',
        sessionId: event.session_id,
        userId: event.user_id || 'unknown',
        tags,
      });

      // Create traceparent for cross-process context propagation
      const traceparent = createTraceparent(sessionObs.traceId, sessionObs.id);

      // persist session with traceparent for cross-process linking
      initSession(event.session_id, sessionObs.traceId, sessionObs.id, traceparent);

      DEBUG &&
        log(
          'DEBUG',
          `Created session: ${event.session_id}${
            gitContext.isGitRepo ? ` (${gitContext.repoName}@${gitContext.branch})` : ''
          }`
        );
    }
  }

  switch (event.hook_event_name) {
    case 'PreToolUse': {
      if (!event.tool_name || !event.tool_use_id) break;

      const isSubagent = isSubagentTool(event.tool_name);
      const subagentInfo = isSubagent ? getSubagentInfo(event.tool_input) : null;

      const ctx: ToolContext = {
        toolName: event.tool_name,
        toolUseId: event.tool_use_id,
        toolInput: event.tool_input,
        isSubagent,
        subagentType: subagentInfo?.type,
        subagentDescription: subagentInfo?.description,
        subagentModel: subagentInfo?.model,
        model: event.model,
      };

      // Resolve parent: check if this tool has a parent_tool_use_id (nested under another tool/agent)
      let actualParent: SessionObservation | ToolObservation | undefined = sessionObs;
      if (event.parent_tool_use_id) {
        const parentActive = activeObservations.get(event.parent_tool_use_id);
        if (parentActive) {
          actualParent = parentActive.observation;
        }
      }

      // Create observation with proper hierarchy using v4 SDK asType
      // If no in-memory parent but we have a persisted session, use traceparent for cross-process linking
      let observation: ToolObservation;
      if (!actualParent && persistedSession?.traceparent) {
        observation = createToolObservationWithContext(
          ctx,
          persistedSession.traceparent,
          event.session_id
        );
        DEBUG &&
          log(
            'DEBUG',
            `PreToolUse cross-process with traceparent: ${persistedSession.traceparent}`
          );
      } else {
        observation = createToolObservation(ctx, undefined, actualParent);
      }

      // Get tool chain context for cascade failure detection
      const chainContext = getToolChainContext(event.session_id);

      activeObservations.set(event.tool_use_id, {
        observation,
        startTime: Date.now(),
        ctx,
        chainContext,
      });

      // Create traceparent for this span (for nested tool linking)
      const spanTraceparent = createTraceparent(observation.traceId, observation.id);

      // Persist context for cross-process retrieval (includes observationId for upsert)
      registerActiveSpan(event.session_id, event.tool_use_id, {
        spanId: observation.id,
        observationId: observation.id, // Store for upsert in PostToolUse
        traceId: observation.traceId,
        parentSpanId: actualParent?.id,
        parentObservationId: actualParent?.id, // Store parent observation ID for Langfuse hierarchy
        traceparent: spanTraceparent,
        startTime: Date.now(),
        ctx,
        parent_tool_use_id: event.parent_tool_use_id ?? undefined,
      });

      // For Task (subagent) tools, store pending parent context for the spawned subagent to find
      if (isSubagent) {
        const pendingContext: PendingParentContext = {
          traceparent: spanTraceparent,
          traceId: observation.traceId,
          observationId: observation.id,
          parentSessionId: event.session_id,
          toolUseId: event.tool_use_id,
          subagentType: subagentInfo?.type,
          createdAt: Date.now(),
        };
        storePendingParentContext(pendingContext);
        DEBUG &&
          log(
            'DEBUG',
            `Stored pending parent context for subagent: ${subagentInfo?.type || 'Task'}`
          );
      }

      log(
        'INFO',
        `PreToolUse: ${event.tool_name} (${event.tool_use_id}) parent=${actualParent?.id ?? 'root'}`
      );
      break;
    }

    case 'PostToolUse': {
      if (!event.tool_name) break;

      const analysis = analyzeToolResult(event.tool_response);
      const isSubagent = isSubagentTool(event.tool_name);
      const subagentInfo = isSubagent ? getSubagentInfo(event.tool_input) : null;

      let toolDurationMs: number | undefined;

      // Check if there's a persisted span for cross-process handling FIRST
      // This determines whether we're in cross-process mode
      const persistedSpan = event.tool_use_id
        ? popActiveSpan(event.session_id, event.tool_use_id)
        : undefined;

      const active = event.tool_use_id ? activeObservations.get(event.tool_use_id) : undefined;

      // DEDUPLICATION: If we have both in-memory AND persisted span, prefer in-memory
      // and skip cross-process path to prevent duplicate observations
      const isCrossProcess = !active && !!persistedSpan;

      if (active) {
        const durationMs = Date.now() - active.startTime;
        toolDurationMs = durationMs;
        const result: ToolResult = {
          success: analysis.success,
          error: analysis.error ?? undefined,
          errorType: analysis.errorType ?? undefined,
          exitCode: analysis.exitCode ?? undefined,
          output: event.tool_response,
          durationMs,
        };

        // Debug log tokens if available
        if (event.tokens) {
          debugLog(
            `PostToolUse tokens for ${event.tool_name}: input=${event.tokens.input ?? 0}, output=${event.tokens.output ?? 0}, total=${event.tokens.total ?? 0}`
          );
        }

        finalizeToolObservation(active.observation, result, active.ctx, event.tokens);
        activeObservations.delete(event.tool_use_id!);

        // Record scores for failure tracking
        // Check if preceding tool failed for cascade detection
        const precedingFailed = active.chainContext?.precedingSuccess === false;
        const langfuse = getLangfuseClient();
        if (langfuse) {
          if (result.success) {
            recordToolSuccessScores(
              langfuse,
              active.observation.traceId,
              active.observation.id
            ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
          } else {
            recordToolFailureScores(
              langfuse,
              active.observation.traceId,
              active.observation.id,
              result.errorType,
              precedingFailed
            ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
          }
        }

        // Update tool chain state for next tool
        updateToolChainState(event.session_id, event.tool_name, result.success);

        // Note: persistedSpan was already popped at the top of PostToolUse handler
        // No need to pop again here

        // NOTE: Pending parent context cleanup moved to SubagentStop handler.
        // The SubagentStop event fires AFTER PostToolUse for Task tools, so we must
        // keep the pending context available until SubagentStop can use it for linking.

        const tokenInfo = event.tokens?.total ? `, tokens: ${event.tokens.total}` : '';
        log(
          'INFO',
          `${event.tool_name}${
            subagentInfo ? ` (${subagentInfo.type})` : ''
          } (${durationMs}ms): ${analysis.success ? 'OK' : 'ERROR'}${tokenInfo}`
        );
      } else if (isCrossProcess && persistedSpan) {
        // Cross-process completion - persistedSpan was already popped at the top
        const durationMs = Date.now() - (persistedSpan.startTime ?? Date.now());
        toolDurationMs = durationMs;

        const restoredCtx: ToolContext = persistedSpan.ctx ?? {
          toolName: event.tool_name,
          toolUseId: event.tool_use_id!, // Safe: isCrossProcess requires tool_use_id
          toolInput: event.tool_input,
          isSubagent,
          subagentType: subagentInfo?.type,
          subagentDescription: subagentInfo?.description,
          subagentModel: subagentInfo?.model,
          model: event.model,
        };

        // Build result and metadata for upsert
        const result: ToolResult = {
          success: analysis.success,
          error: analysis.error ?? undefined,
          errorType: analysis.errorType ?? undefined,
          exitCode: analysis.exitCode ?? undefined,
          output: event.tool_response,
          durationMs,
        };

        const resultMetadata: Record<string, unknown> = {
          success: result.success,
          duration_ms: durationMs,
        };
        if (result.error) resultMetadata.error = result.error;
        if (result.errorType) resultMetadata.error_type = result.errorType;
        if (result.exitCode !== undefined) resultMetadata.exit_code = result.exitCode;
        if (restoredCtx.isSubagent) {
          if (restoredCtx.subagentType) resultMetadata.subagent_type = restoredCtx.subagentType;
          if (restoredCtx.subagentDescription)
            resultMetadata.subagent_description = restoredCtx.subagentDescription;
          if (restoredCtx.subagentModel) resultMetadata.subagent_model = restoredCtx.subagentModel;
        }
        // Build usageDetails for Langfuse if tokens are available
        let usageDetails: Record<string, number> | undefined;
        if (event.tokens && (event.tokens.input || event.tokens.output || event.tokens.total)) {
          usageDetails = {
            input: event.tokens.input ?? 0,
            output: event.tokens.output ?? 0,
            total: event.tokens.total ?? (event.tokens.input ?? 0) + (event.tokens.output ?? 0),
          };
          // Also store in metadata for visibility as backup
          resultMetadata.token_usage = {
            input_tokens: usageDetails.input,
            output_tokens: usageDetails.output,
            total_tokens: usageDetails.total,
          };
        }

        // Use upsert if we have an observationId from PreToolUse (prevents duplicates)
        if (persistedSpan.observationId) {
          // Parse traceparent to get parent span context for hierarchy
          const parsedParent = persistedSpan.traceparent
            ? parseTraceparent(persistedSpan.traceparent)
            : null;
          const parentSpanContext = parsedParent
            ? {
                traceId: parsedParent.traceId,
                spanId: parsedParent.spanId,
                traceFlags: parsedParent.traceFlags,
                isRemote: true as const,
              }
            : undefined;

          const upsertedObs = upsertToolObservation({
            id: persistedSpan.observationId, // Same ID = upsert, not create
            traceId: persistedSpan.traceId || '',
            name: restoredCtx.isSubagent
              ? restoredCtx.subagentType
                ? `Agent:${restoredCtx.subagentType}`
                : `Agent:${restoredCtx.toolName}`
              : restoredCtx.toolName,
            startTime: new Date(persistedSpan.startTime ?? Date.now()),
            endTime: new Date(),
            output: event.tool_response,
            level: result.success ? 'DEFAULT' : 'ERROR',
            statusMessage: formatStatusMessage(result, restoredCtx.toolName),
            metadata: resultMetadata,
            sessionId: event.session_id,
            parentSpanContext,
            observationType: restoredCtx.isSubagent ? 'agent' : 'tool',
            parentObservationId: persistedSpan.parentObservationId, // Pass parent observation ID for hierarchy metadata
            usageDetails, // Pass usageDetails for Langfuse cost tracking
          });
          debugLog(
            `Cross-process upsert with observationId: ${upsertedObs.id} (original: ${persistedSpan.observationId})${usageDetails ? `, tokens: ${usageDetails.total}` : ''}`
          );

          // Record scores for cross-process upsert
          // Use the actual observation IDs from the upserted observation
          const chainContext = getToolChainContext(event.session_id);
          const precedingFailed = chainContext?.precedingSuccess === false;
          const langfuse = getLangfuseClient();
          if (langfuse && upsertedObs.id && upsertedObs.traceId) {
            if (result.success) {
              recordToolSuccessScores(langfuse, upsertedObs.traceId, upsertedObs.id).catch(
                (e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`)
              );
            } else {
              recordToolFailureScores(
                langfuse,
                upsertedObs.traceId,
                upsertedObs.id,
                result.errorType,
                precedingFailed
              ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
            }
          }

          // Update tool chain state
          updateToolChainState(event.session_id, event.tool_name, result.success);
        } else {
          // Legacy fallback: create new observation (may cause duplicates)
          let observation: ToolObservation;
          if (persistedSpan.traceparent) {
            observation = createToolObservationWithContext(
              restoredCtx,
              persistedSpan.traceparent,
              event.session_id,
              persistedSpan.parentObservationId
            );
            debugLog(
              `Cross-process observation with span traceparent: ${persistedSpan.traceparent}`
            );
          } else if (persistedSession?.traceparent) {
            observation = createToolObservationWithContext(
              restoredCtx,
              persistedSession.traceparent,
              event.session_id,
              persistedSpan.parentObservationId
            );
            debugLog(
              `Cross-process observation with session traceparent: ${persistedSession.traceparent}`
            );
          } else {
            observation = createToolObservation(restoredCtx, undefined, sessionObs);
            debugLog(`Cross-process observation with in-memory session (no traceparent)`);
          }
          finalizeToolObservation(observation, result, restoredCtx, event.tokens);

          // Record scores for legacy path
          // Get chain context from persisted state for cascade detection
          const chainContext = getToolChainContext(event.session_id);
          const precedingFailed = chainContext?.precedingSuccess === false;
          const langfuse = getLangfuseClient();
          if (langfuse) {
            if (result.success) {
              recordToolSuccessScores(langfuse, observation.traceId, observation.id).catch(
                (e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`)
              );
            } else {
              recordToolFailureScores(
                langfuse,
                observation.traceId,
                observation.id,
                result.errorType,
                precedingFailed
              ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
            }
          }

          // Update tool chain state
          updateToolChainState(event.session_id, event.tool_name, result.success);
        }

        // NOTE: Pending parent context cleanup moved to SubagentStop handler.
        // The SubagentStop event fires AFTER PostToolUse for Task tools, so we must
        // keep the pending context available until SubagentStop can use it for linking.

        log(
          'INFO',
          `${event.tool_name}${subagentInfo ? ` (${subagentInfo.type})` : ''} (${durationMs}ms): ${
            analysis.success ? 'OK' : 'ERROR'
          } [cross-process${persistedSpan.observationId ? '-upsert' : ''}]`
        );
      } else if (event.tool_use_id) {
        // Fallback: no persisted span and no in-memory -> create observation attached to session
        const ctx: ToolContext = {
          toolName: event.tool_name ?? 'unknown',
          toolUseId: event.tool_use_id ?? 'unknown',
          toolInput: event.tool_input,
          isSubagent,
          subagentType: subagentInfo?.type,
          subagentDescription: subagentInfo?.description,
          subagentModel: subagentInfo?.model,
          model: event.model,
        };

        // Use session traceparent if available for cross-process linking
        let obs: ToolObservation;
        if (persistedSession?.traceparent) {
          obs = createToolObservationWithContext(
            ctx,
            persistedSession.traceparent,
            event.session_id
          );
        } else {
          obs = createToolObservation(ctx, undefined, sessionObs);
        }

        const result: ToolResult = {
          success: analysis.success,
          error: analysis.error ?? undefined,
          errorType: analysis.errorType ?? undefined,
          exitCode: analysis.exitCode ?? undefined,
          output: event.tool_response,
        };

        finalizeToolObservation(obs, result, ctx, event.tokens);

        // Record scores for no-persist path
        const chainContext = getToolChainContext(event.session_id);
        const precedingFailed = chainContext?.precedingSuccess === false;
        const langfuse = getLangfuseClient();
        if (langfuse) {
          if (result.success) {
            recordToolSuccessScores(langfuse, obs.traceId, obs.id).catch(
              (e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`)
            );
          } else {
            recordToolFailureScores(
              langfuse,
              obs.traceId,
              obs.id,
              result.errorType,
              precedingFailed
            ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
          }
        }

        // Update tool chain state
        updateToolChainState(event.session_id, event.tool_name, result.success);

        log(
          'INFO',
          `${event.tool_name}${
            subagentInfo ? ` (${subagentInfo.type})` : ''
          }: ${analysis.success ? 'OK' : 'ERROR'} [no-persist]`
        );
      } else {
        // No tool_use_id - create standalone observation attached to session
        const ctx: ToolContext = {
          toolName: event.tool_name ?? 'unknown',
          toolUseId: 'unknown',
          toolInput: event.tool_input,
          isSubagent,
          subagentType: subagentInfo?.type,
          subagentDescription: subagentInfo?.description,
          subagentModel: subagentInfo?.model,
          model: event.model,
        };

        // Use session traceparent if available for cross-process linking
        let observation: ToolObservation;
        if (persistedSession?.traceparent) {
          observation = createToolObservationWithContext(
            ctx,
            persistedSession.traceparent,
            event.session_id
          );
        } else {
          observation = createToolObservation(ctx, undefined, sessionObs);
        }

        const result: ToolResult = {
          success: analysis.success,
          error: analysis.error ?? undefined,
          errorType: analysis.errorType ?? undefined,
          exitCode: analysis.exitCode ?? undefined,
          output: event.tool_response,
        };

        finalizeToolObservation(observation, result, ctx, event.tokens);

        // Record scores for no-id path
        const chainContext = getToolChainContext(event.session_id);
        const precedingFailed = chainContext?.precedingSuccess === false;
        const langfuse = getLangfuseClient();
        if (langfuse) {
          if (result.success) {
            recordToolSuccessScores(langfuse, observation.traceId, observation.id).catch(
              (e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`)
            );
          } else {
            recordToolFailureScores(
              langfuse,
              observation.traceId,
              observation.id,
              result.errorType,
              precedingFailed
            ).catch((e) => DEBUG && log('DEBUG', `Score recording failed: ${e}`));
          }
        }

        // Update tool chain state
        updateToolChainState(event.session_id, event.tool_name, result.success);

        log(
          'INFO',
          `${event.tool_name}${
            subagentInfo ? ` (${subagentInfo.type})` : ''
          }: ${analysis.success ? 'OK' : 'ERROR'} [no-id]`
        );
      }

      // Update session metrics after tool completion
      updateSessionMetrics(
        event.session_id,
        event.tool_name ?? 'unknown',
        isSubagent,
        analysis.success,
        analysis.errorType ?? undefined,
        toolDurationMs,
        event.tokens,
        event.model
      );

      break;
    }

    case 'UserPromptSubmit': {
      // Create fingerprint for deduplication (use timestamp bucket since no tool_use_id)
      const fingerprint = createEventFingerprint('UserPromptSubmit');

      // Check if this event was already processed (cross-process duplicate)
      if (hasProcessedEvent(event.session_id, fingerprint)) {
        DEBUG && log('DEBUG', `UserPromptSubmit skipped (duplicate): ${fingerprint}`);
        break;
      }

      const promptMetadata: Record<string, unknown> = {
        permission_mode: event.permission_mode,
        timestamp: event.timestamp || new Date().toISOString(),
        prompt_received: !!event.prompt,
      };

      // Capture the user prompt as input
      const promptInput = event.prompt || null;

      if (sessionObs) {
        recordEvent('user_prompt', promptInput, promptMetadata, sessionObs);
        markEventProcessed(event.session_id, fingerprint);
      } else if (persistedSession?.traceparent) {
        // Cross-process: use traceparent to link to correct trace
        // Pass sessionSpanId as parent observation ID for proper hierarchy
        recordEventWithContext(
          'user_prompt',
          promptInput,
          promptMetadata,
          persistedSession.traceparent,
          event.session_id,
          persistedSession.sessionSpanId
        );
        markEventProcessed(event.session_id, fingerprint);
      }
      DEBUG && log('DEBUG', `UserPromptSubmit: ${promptInput ? 'with prompt' : 'no prompt field'}`);
      break;
    }

    case 'PreCompact': {
      const compactMetadata: Record<string, unknown> = {
        timestamp: event.timestamp || new Date().toISOString(),
        trigger: event.trigger || 'unknown', // "manual" or "auto"
        event_type: 'pre_compact',
      };

      if (event.custom_instructions) {
        compactMetadata.has_custom_instructions = true;
      }

      if (sessionObs) {
        recordEvent('compact_started', null, compactMetadata, sessionObs);
      } else if (persistedSession?.traceparent) {
        // Pass sessionSpanId as parent observation ID for proper hierarchy
        recordEventWithContext(
          'compact_started',
          null,
          compactMetadata,
          persistedSession.traceparent,
          event.session_id,
          persistedSession.sessionSpanId
        );
      }
      log('INFO', `PreCompact (trigger: ${event.trigger || 'unknown'})`);
      break;
    }

    case 'PostCompact': {
      const compactMetadata: Record<string, unknown> = {
        timestamp: event.timestamp || new Date().toISOString(),
        trigger: event.trigger || 'unknown',
        event_type: 'post_compact',
        compaction_complete: true,
      };

      if (sessionObs) {
        recordEvent('compact_completed', null, compactMetadata, sessionObs);
      } else if (persistedSession?.traceparent) {
        // Pass sessionSpanId as parent observation ID for proper hierarchy
        recordEventWithContext(
          'compact_completed',
          null,
          compactMetadata,
          persistedSession.traceparent,
          event.session_id,
          persistedSession.sessionSpanId
        );
      }
      log('INFO', 'PostCompact completed');
      break;
    }

    case 'SubagentStop': {
      // Create fingerprint for deduplication - use agent_id if available, else timestamp bucket
      const fingerprint = createEventFingerprint('SubagentStop', event.agent_id);

      // Check if this event was already processed (cross-process duplicate)
      if (hasProcessedEvent(event.session_id, fingerprint)) {
        DEBUG && log('DEBUG', `SubagentStop skipped (duplicate): ${fingerprint}`);
        break;
      }

      // Get session metrics for richer data
      const metrics = getSessionMetrics(event.session_id);

      // Find pending parent context using the subagent session's traceparent for matching.
      // This also removes the context after finding it (cleanup moved from PostToolUse).
      // The pending context is stored by PreToolUse and needs to persist until SubagentStop
      // because SubagentStop fires AFTER PostToolUse for Task tools.
      const parentTraceparent = persistedSession?.traceparent;
      const pendingContext = findAndRemovePendingParentContextBySession(
        event.session_id,
        parentTraceparent
      );

      // Extract structured subagent stop info from multiple sources
      const stopInfo = getSubagentStopInfo(event, pendingContext, metrics);

      const eventMetadata: Record<string, unknown> = {
        stop_hook_active: event.stop_hook_active ?? false,
        timestamp: event.timestamp || new Date().toISOString(),
        has_agent_id: !!event.agent_id,
        has_transcript: !!event.agent_transcript_path,
        has_parent_context: !!pendingContext,
        // Add debugging info for parent context resolution
        parent_context_matched: !!pendingContext,
        used_traceparent_for_match: !!parentTraceparent,
      };

      if (sessionObs) {
        // In-memory session available (same process)
        recordEvent('subagent_completed', stopInfo, eventMetadata, sessionObs);
        markEventProcessed(event.session_id, fingerprint);
      } else if (persistedSession?.traceparent) {
        // Cross-process: use traceparent to link to correct trace
        // This is the fallback that ensures the event is linked even if pendingContext wasn't found
        // Pass sessionSpanId as parent observation ID for proper hierarchy
        recordEventWithContext(
          'subagent_completed',
          stopInfo,
          eventMetadata,
          persistedSession.traceparent,
          event.session_id,
          persistedSession.sessionSpanId
        );
        markEventProcessed(event.session_id, fingerprint);
        DEBUG &&
          log(
            'DEBUG',
            `SubagentStop with cross-process traceparent: ${persistedSession.traceparent}`
          );
      } else if (pendingContext) {
        // Fallback: we found pending context but no session - use pending context's traceparent
        // Pass pending context's observationId as parent observation ID
        recordEventWithContext(
          'subagent_completed',
          stopInfo,
          eventMetadata,
          pendingContext.traceparent,
          event.session_id,
          pendingContext.observationId
        );
        markEventProcessed(event.session_id, fingerprint);
        DEBUG &&
          log(
            'DEBUG',
            `SubagentStop with pending context traceparent: ${pendingContext.traceparent}`
          );
      } else {
        // Last resort: create orphan event (will not be linked)
        recordEvent('subagent_completed', stopInfo, eventMetadata);
        markEventProcessed(event.session_id, fingerprint);
        DEBUG && log('DEBUG', 'SubagentStop without session context (orphan event)');
      }

      log(
        'INFO',
        `Subagent completed${stopInfo?.agent_id ? ` (${stopInfo.agent_id})` : ''}${stopInfo?.session_summary ? ` - tools: ${stopInfo.session_summary.tool_count}` : ''}${pendingContext ? ' [parent-linked]' : ''}`
      );
      break;
    }

    case 'Stop': {
      // End any orphaned observations
      if (activeObservations.size > 0) {
        DEBUG && log('DEBUG', `Cleaning up ${activeObservations.size} incomplete observations`);
        for (const [, { observation, ctx }] of activeObservations) {
          const result: ToolResult = {
            success: false,
            error: 'Session ended before completion',
            errorType: 'incomplete',
          };
          finalizeToolObservation(observation, result, ctx);
        }
        activeObservations.clear();
      }

      // Retrieve session metrics BEFORE deleting state
      const sessionMetrics = getSessionMetrics(event.session_id);
      const aggregateMetrics = sessionMetrics
        ? calculateAggregateMetrics(sessionMetrics)
        : undefined;

      // End session observation with metrics
      if (sessionObs) {
        finalizeSessionObservation(sessionObs, {
          ended: true,
          timestamp: event.timestamp || new Date().toISOString(),
          metrics: sessionMetrics ?? undefined,
          aggregateMetrics,
        });

        // Record session-level health scores
        if (sessionMetrics) {
          const langfuse = getLangfuseClient();
          if (langfuse) {
            recordSessionHealthScores(
              langfuse,
              sessionObs.traceId,
              sessionMetrics.toolCount,
              sessionMetrics.errorCount,
              sessionMetrics.errorsByType
            ).catch((e) => DEBUG && log('DEBUG', `Session score recording failed: ${e}`));
          }
        }

        sessionObservations.delete(event.session_id);
      }

      // Log metrics summary
      if (sessionMetrics) {
        const { toolCount, subagentCount, errorCount } = sessionMetrics;
        log(
          'INFO',
          `Session ended - tools: ${toolCount}, subagents: ${subagentCount}, errors: ${errorCount}`
        );
      } else {
        log('INFO', 'Session ended');
      }

      // Clean up processed events for this session before deleting state
      cleanupProcessedEvents(event.session_id);

      // Clean up persisted state for this session
      deleteSpanState(event.session_id);

      // Periodically clean up old state files (stale sessions)
      cleanupOldStates();

      // Periodically clean up expired pending parent contexts
      cleanupPendingParentContexts();

      break;
    }
  }
}

// Main entry point
async function main() {
  const tracingConfig = createConfigFromEnv();
  const initialized = initTracing(tracingConfig);

  if (!initialized) {
    process.exit(1);
  }

  const rl = createInterface({ input: process.stdin, terminal: false });

  rl.on('line', (line) => {
    debugLog(`Received line (${line.length} chars): ${line.substring(0, 200)}...`);
    try {
      const data = JSON.parse(line);
      debugLog(
        `Parsed event: type=${data.type || data.hook_event_name}, session=${data.session_id}, tool=${data.tool_name || 'n/a'}`
      );
      // Log UserPromptSubmit prompt field
      if (data.hook_event_name === 'UserPromptSubmit') {
        debugLog(
          `UserPromptSubmit prompt: ${data.prompt ? `"${data.prompt.substring(0, 100)}..."` : 'absent'}`
        );
      }
      if (isValidEvent(data)) {
        processEvent(data);
        debugLog(`Event processed successfully`);
      } else {
        debugLog(`Invalid event structure - missing required fields`);
        DEBUG && log('DEBUG', 'Invalid event structure');
      }
    } catch (e) {
      debugLog(`Parse error: ${e}`);
      DEBUG && log('DEBUG', `Parse error: ${e}`);
    }
  });

  const shutdown = async () => {
    debugLog(`Shutdown initiated - ${sessionObservations.size} active sessions`);
    // NOTE: Do NOT finalize sessions here!
    // Sessions should only be ended by the explicit "Stop" event.
    // Each hook invocation is a separate process, and the session span
    // should remain "open" until the Stop event comes in a future process.
    // Just flush pending spans without ending sessions.

    try {
      // Explicitly flush spans and scores before shutdown to ensure export completes
      debugLog(`Flushing spans and scores to Langfuse...`);
      await forceFlush();
      await flushScores();
      await shutdownTracing();
      debugLog(`Shutdown complete`);
    } catch (e) {
      debugLog(`Shutdown error: ${e}`);
    }
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  rl.on('close', shutdown);
}

main().catch((e) => {
  log('ERROR', `Fatal: ${e}`);
  process.exit(1);
});
