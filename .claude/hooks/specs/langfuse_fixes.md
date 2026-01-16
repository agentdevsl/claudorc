# Langfuse Hook Fixes Documentation

## Overview

This document outlines 5 critical issues identified in the Langfuse hook implementation and their proposed fixes.

**Investigation Date:** 2025-12-04
**Affected Files:** `.claude/hooks/src/`

---

## Issue 1: Duplicate Observations (Critical)

### Problem

When `PostToolUse` runs in a different process than `PreToolUse`, it creates a **NEW observation** instead of updating the existing one, causing duplicate entries in Langfuse.

**Evidence from logs:**

```json
{
  "subagent_completed (375085ea)": { ... },
  "subagent_completed (0a400257)": { ... }  // Duplicate!
}
```

### Root Cause

**Location:** `langfuse-hook.ts:364-401` and `observations.ts:495-608`

Each Claude Code hook invocation is a separate Node.js process:

- **Process 1:** PreToolUse → creates observation (ID: abc123) → exits
- **Process 2:** PostToolUse → creates NEW observation (ID: def456) → DUPLICATE

The Langfuse SDK v4 `startObservation()` always creates new observations - there's no `resumeObservation(id)` method.

```typescript
// Current problematic code (langfuse-hook.ts:388-401)
if (persistedSpan.traceparent) {
  // CREATES NEW observation - this is the duplicate source!
  observation = createToolObservationWithContext(
    restoredCtx,
    persistedSpan.traceparent,
    event.session_id
  );
}
```

### Fix Approach

**Strategy:** Persist observation ID from PreToolUse, use Langfuse Ingestion API in PostToolUse to **upsert** (same ID = update, not create)

#### Files to Modify

1. **`persistence.ts`** - Add `observationId` to `ActiveSpanInfo` interface
2. **`langfuse-hook.ts`** - Capture and persist `observation.id` in PreToolUse
3. **`provider.ts`** - Add Langfuse client singleton for API access
4. **NEW `ingestion-client.ts`** - Upsert function using Langfuse Ingestion API

#### Implementation

```typescript
// 1. persistence.ts - Add observationId field
export interface ActiveSpanInfo {
  spanId: string;
  observationId: string; // NEW: For upsert in PostToolUse
  startTime: number;
  traceId?: string;
  // ... existing fields
}

// 2. langfuse-hook.ts PreToolUse - Persist observationId
registerActiveSpan(event.session_id, event.tool_use_id, {
  spanId: observation.id,
  observationId: observation.id, // NEW
  // ... rest
});

// 3. langfuse-hook.ts PostToolUse - Upsert instead of create
const persistedSpan = popActiveSpan(event.session_id, event.tool_use_id);
if (persistedSpan?.observationId) {
  // Upsert via ingestion API (same ID = update, not duplicate)
  await upsertObservation({
    id: persistedSpan.observationId, // Same ID = upsert
    traceId: persistedSpan.traceId,
    startTime: new Date(persistedSpan.startTime),
    endTime: new Date(),
    output: event.tool_response,
    level: analysis.success ? 'DEFAULT' : 'ERROR',
    metadata: { success: analysis.success, duration_ms: durationMs },
  });
}

// 4. NEW ingestion-client.ts
export async function upsertObservation(params: UpsertParams): Promise<void> {
  const client = getLangfuseClient();
  await client.span({
    id: params.id, // Same ID triggers upsert
    traceId: params.traceId,
    startTime: params.startTime,
    endTime: params.endTime,
    output: params.output,
    // ...
  });
}
```

**Reference:** [Langfuse Ingestion API - Upsert Behavior](https://langfuse.com/faq/all/tracing-data-updates)

---

## Issue 2: Zero Token Usage

### Problem

All observations show zero token usage in Langfuse:

```json
"inputUsage": 0,
"outputUsage": 0,
"totalUsage": 0,
"totalCost": 0
```

### Root Cause

**Location:** `observations.ts:726-766`

The `_tokens` parameter in `finalizeToolObservation()` is **intentionally unused** (underscore prefix):

```typescript
export function finalizeToolObservation(
  observation: ToolObservation,
  result: ToolResult,
  ctx?: Partial<ToolContext>,
  _tokens?: TokenUsage // ← UNUSED! Underscore indicates intentionally ignored
): void {
  // ... tokens are NEVER passed to observation.update()
}
```

Token data IS passed from `langfuse-hook.ts:343,412` but never applied to observations.

### Fix Approach

**Strategy:** Remove underscore prefix and store tokens in observation metadata

**Note:** Langfuse SDK v4 agent/tool observation types don't support `usageDetails` (only generation type does). Store in metadata instead.

#### Files to Modify

1. **`observations.ts`** - Fix `finalizeToolObservation()` to use tokens

#### Implementation

```typescript
// observations.ts:726-766
export function finalizeToolObservation(
  observation: ToolObservation,
  result: ToolResult,
  ctx?: Partial<ToolContext>,
  tokens?: TokenUsage // ← Remove underscore, make functional
): void {
  const metadata: Record<string, unknown> = {
    success: result.success,
  };

  // ... existing metadata ...

  // NEW: Add token usage to metadata if available
  if (tokens && (tokens.input || tokens.output || tokens.total)) {
    metadata.token_usage = {
      input_tokens: tokens.input ?? 0,
      output_tokens: tokens.output ?? 0,
      total_tokens: tokens.total ?? (tokens.input ?? 0) + (tokens.output ?? 0),
    };
  }

  observation.update({
    output: result.output,
    level,
    statusMessage: result.error,
    metadata, // Now includes token_usage
  });

  observation.end();
}
```

---

## Issue 3: Empty SubagentStop Input/Output

### Problem

SubagentStop events have null input/output:

```json
{
  "name": "subagent_completed",
  "input": null,
  "output": null
}
```

### Root Cause

**Location:** `langfuse-hook.ts:576-595`

The handler explicitly passes `null` for input:

```typescript
case "SubagentStop": {
  const eventMetadata = { ... };

  // Input is explicitly null!
  recordEvent("subagent_completed", null, eventMetadata, sessionObs);
}
```

No data is captured from:

- Event fields (`agent_id`, `agent_transcript_path` added in Claude Code v2.0.42+)
- Pending parent context (Task tool metadata)
- Session metrics (aggregate performance)

### Fix Approach

**Strategy:** Multi-source data aggregation from event fields, pending context, and session metrics

#### Files to Modify

1. **`utils.ts`** - Add `ClaudeCodeEvent` fields + `getSubagentStopInfo()` utility
2. **`langfuse-hook.ts`** - Enhance SubagentStop handler

#### Implementation

```typescript
// 1. utils.ts - Add new interface and function

// Update ClaudeCodeEvent interface (v2.0.42+ fields)
export interface ClaudeCodeEvent {
  // ... existing fields ...
  agent_id?: string;                  // NEW (v2.0.42+)
  agent_transcript_path?: string;     // NEW (v2.0.42+)
}

export interface SubagentStopInfo {
  agent_id?: string;
  transcript_preview?: string;
  transcript_path?: string;
  parent_task_type?: string;
  parent_task_description?: string;
  session_summary?: {
    tool_count?: number;
    subagent_count?: number;
    error_count?: number;
    total_duration_ms?: number;
  };
}

export function getSubagentStopInfo(
  event: ClaudeCodeEvent,
  pendingContext?: PendingParentContext | null,
  metrics?: SessionMetrics | null
): SubagentStopInfo | null {
  const info: SubagentStopInfo = {};

  // Source 1: Direct event fields (v2.0.42+)
  if (event.agent_id) info.agent_id = event.agent_id;
  if (event.agent_transcript_path) {
    info.transcript_path = event.agent_transcript_path;
    info.transcript_preview = readTranscriptExcerpt(event.agent_transcript_path);
  }

  // Source 2: Pending parent context
  if (pendingContext?.subagentType) {
    info.parent_task_type = pendingContext.subagentType;
  }

  // Source 3: Session metrics
  if (metrics) {
    info.session_summary = {
      tool_count: metrics.toolCount,
      error_count: metrics.errorCount,
      total_duration_ms: metrics.totalDurationMs,
    };
  }

  return Object.keys(info).length > 0 ? info : null;
}

// 2. langfuse-hook.ts - Enhanced SubagentStop handler
case "SubagentStop": {
  const pendingContext = findPendingParentContext();
  const metrics = getSessionMetrics(event.session_id);
  const stopInfo = getSubagentStopInfo(event, pendingContext, metrics);

  const eventMetadata = {
    stop_hook_active: event.stop_hook_active ?? false,
    timestamp: event.timestamp || new Date().toISOString(),
    has_agent_id: !!event.agent_id,
    has_parent_context: !!pendingContext,
  };

  // Pass structured data instead of null
  recordEvent("subagent_completed", stopInfo, eventMetadata, sessionObs);
}
```

---

## Issue 4: Missing Parent Observation IDs

### Problem

All events have null `parentObservationId`:

```json
"parentObservationId": null
```

### Root Cause

**Location:** `observations.ts:619-646`

Events are created with `parentSpanContext` for OpenTelemetry trace linking, but `parentObservationId` displays as null because:

1. Events use `asType: "event"` which are point-in-time markers
2. Parent relationship is via OpenTelemetry's span context, not Langfuse's native hierarchy
3. This is **expected behavior** for cross-process distributed tracing

### Fix Approach

**Strategy:** This is working correctly - parent relationships exist via span context. Add `parent_observation_id` to metadata for visibility (already implemented at line 317).

**Verification:** Check that parent-child tree displays correctly in Langfuse UI trace visualization even with null `parentObservationId` field.

---

## Issue 5: Generic Service Name

### Problem

OpenTelemetry shows generic service name:

```json
"service.name": "unknown_service:node"
```

### Root Cause

**Location:** `provider.ts:59-61`

No OpenTelemetry Resource is configured with service attributes:

```typescript
// Current code - no Resource
provider = new NodeTracerProvider({
  spanProcessors: [new LangfuseSpanProcessor()],
});
```

### Fix Approach

**Strategy:** Create OpenTelemetry Resource with service.name, service.version, deployment.environment

#### Files to Modify

1. **`provider.ts`** - Add Resource configuration

#### Implementation

```typescript
// provider.ts - Add imports
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

// Add Resource factory function
function createServiceResource(environment: string): Resource {
  return new Resource({
    [ATTR_SERVICE_NAME]: 'claude-code-langfuse-hook',
    [ATTR_SERVICE_VERSION]: '2.0.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT]: environment,
  });
}

// Update initTracing()
export function initTracing(config: TracingConfig): boolean {
  // ... existing validation ...

  const resource = createServiceResource(config.environment || 'development');

  provider = new NodeTracerProvider({
    resource, // NEW: Add resource
    spanProcessors: [new LangfuseSpanProcessor()],
  });

  // ... rest of initialization ...
}
```

**Dependencies to install:**

```bash
npm install @opentelemetry/resources @opentelemetry/semantic-conventions
```

---

## Implementation Priority

| Priority | Issue                           | Effort      | Impact |
| -------- | ------------------------------- | ----------- | ------ |
| **P1**   | Issue 5: Service name           | 15 min      | Low    |
| **P1**   | Issue 2: Token usage            | 30 min      | Medium |
| **P2**   | Issue 3: SubagentStop data      | 1 hour      | Medium |
| **P3**   | Issue 1: Duplicate observations | 2-3 hours   | High   |
| **P4**   | Issue 4: Parent IDs             | Verify only | Low    |

---

## Testing Plan

### Unit Tests

- [ ] Test `getSubagentStopInfo()` with all data source combinations
- [ ] Test token metadata transformation
- [ ] Test upsert vs create logic

### Integration Tests

```bash
# Test cross-process scenario
echo '{"hook_event_name":"PreToolUse",...}' | node dist/langfuse-hook.js
sleep 1
echo '{"hook_event_name":"PostToolUse",...}' | node dist/langfuse-hook.js
```

### Validation Checklist

- [ ] Service name shows "claude-code-langfuse-hook" in Langfuse
- [ ] Token usage appears in observation metadata
- [ ] SubagentStop events have structured input data
- [ ] No duplicate observations for same tool execution
- [ ] Parent-child relationships display correctly in trace tree

---

## References

- [Langfuse Ingestion API - Upsert Behavior](https://langfuse.com/faq/all/tracing-data-updates)
- [Langfuse TypeScript SDK v4](https://langfuse.com/docs/observability/sdk/typescript/overview)
- [OpenTelemetry Resources](https://opentelemetry.io/docs/concepts/resources/)
- [Claude Code v2.0.42 Release Notes](https://blog.sd.idv.tw/en/posts/2025-11-20_claude-code-2.0.41-2.0.47-release-notes/)
