# Langfuse Integration Redesign Plan

## Overview

Migrate the Claude Code Langfuse hook from raw OpenTelemetry spans to the native `@langfuse/tracing` API, leveraging semantic observation types for better visualization and agent workflow tracking.

## Current State

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  @opentelemetry/sdk-node + LangfuseSpanProcessor            │
│                                                             │
│  tracer.startSpan() → Manual attribute setting              │
│  OBSERVATION_TYPE: "span" | "tool"                          │
│  Manual parent-child via context.active()                   │
└─────────────────────────────────────────────────────────────┘
```

### Limitations

1. **Generic types**: Sessions are "span" instead of "agent"
2. **Subagents as tools**: Task tool appears as tool, not nested agent
3. **Manual attributes**: No type safety, error-prone string keys
4. **No semantic richness**: Missing agent-specific metrics
5. **Stateless challenge**: Each hook invocation is separate process

## Proposed State

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  @langfuse/tracing native API                               │
│                                                             │
│  startObservation() with asType: "agent" | "tool"           │
│  Type-safe attributes via TypeScript interfaces             │
│  Automatic parent-child via parentSpanContext               │
└─────────────────────────────────────────────────────────────┘
```

### Observation Type Mapping

| Claude Code Entity      | Current Type | Proposed Type |
| ----------------------- | ------------ | ------------- |
| Session                 | span         | **agent**     |
| Bash, Read, Write, etc. | tool         | tool          |
| Task (subagent)         | tool         | **agent**     |
| Glob, Grep              | tool         | tool          |
| SubagentStop event      | event        | event         |
| Stop event              | event        | event         |

## Key APIs to Use

### Primary Functions

| Function                    | Purpose                         | When to Use                     |
| --------------------------- | ------------------------------- | ------------------------------- |
| `startObservation()`        | Create observation with type    | Every PreToolUse, session start |
| `updateActiveObservation()` | Update with output/metadata     | PostToolUse                     |
| `updateActiveTrace()`       | Set trace-level attrs           | Session metadata                |
| `createTraceId()`           | Generate deterministic trace ID | Link across processes           |
| `getLangfuseTracer()`       | Get tracer for manual spans     | Fallback if needed              |

### Observation Classes

| Class           | Use Case                                      |
| --------------- | --------------------------------------------- |
| `LangfuseAgent` | Claude Code session, Task subagents           |
| `LangfuseTool`  | Bash, Read, Write, Edit, Glob, Grep, WebFetch |
| `LangfuseEvent` | Stop, SubagentStop, UserPromptSubmit          |
| `LangfuseSpan`  | Generic operations (fallback)                 |

### Key Attributes

```typescript
// Trace-level (via updateActiveTrace or propagateAttributes)
{
  name: string,           // "claude-code-session"
  userId: string,         // event.user_id
  sessionId: string,      // event.session_id
  tags: string[],         // ["development", "terraform-provider-bcm"]
  public: boolean         // false
}

// Observation-level (via startObservation attributes)
{
  input: unknown,         // tool_input or session context
  output: unknown,        // tool_response
  metadata: Record<string, unknown>,  // custom data
  level: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR",
  statusMessage: string   // error message if failed
}
```

## Stateless Process Challenge

### Problem

Each hook invocation is a separate Node process:

```
Process 1: PreToolUse → create span → exit (context lost!)
Process 2: PostToolUse → need to find/update span → exit
```

### Solution: Trace ID Persistence

Use `createTraceId(seed)` with deterministic seeds:

```typescript
// Generate consistent trace ID from session_id
const traceId = await createTraceId(event.session_id);

// Reconstruct parent context in each process
const parentSpanContext = {
  traceId,
  spanId: previousSpanId, // From file/env storage
  traceFlags: TraceFlags.SAMPLED,
};

// Create observation linked to parent
const obs = startObservation(
  'Tool:Bash',
  {
    input: event.tool_input,
  },
  {
    asType: 'tool',
    parentSpanContext,
  }
);
```

### Span ID Tracking

Store active span IDs in a file for cross-process linking:

```typescript
// Location: /tmp/langfuse-hook-${session_id}.json
{
  "traceId": "abc123...",
  "sessionSpanId": "def456...",
  "activeSpans": {
    "tool_use_id_1": "span_id_1",
    "tool_use_id_2": "span_id_2"
  }
}
```

## Implementation Phases

### Phase 1: Quick Win (Observation Types)

- Change session OBSERVATION_TYPE from "span" to "agent"
- Change Task tool OBSERVATION_TYPE from "tool" to "agent"
- Keep existing OTEL + LangfuseSpanProcessor architecture
- **Effort**: 1 hour
- **Impact**: Immediate UI improvement

### Phase 2: Native API Migration

- Replace `tracer.startSpan()` with `startObservation()`
- Use type-safe attribute interfaces
- Implement `createTraceId()` for deterministic IDs
- **Effort**: 4-6 hours
- **Impact**: Type safety, cleaner code

### Phase 3: Span ID Persistence

- Implement file-based span ID tracking
- Enable true PreToolUse → PostToolUse linking
- Calculate accurate durations
- **Effort**: 2-3 hours
- **Impact**: Accurate timing, parent-child relationships

### Phase 4: Enhanced Agent Features

- Add agent-specific metadata (tool count, iterations)
- Implement subagent nesting visualization
- Add error recovery tracking
- **Effort**: 2-3 hours
- **Impact**: Rich agent analytics

## File Structure Changes

```
src/
├── langfuse-hook.ts          # Main hook (refactored)
├── utils.ts                  # Existing utilities
├── tracing/
│   ├── index.ts              # Export all tracing utilities
│   ├── provider.ts           # TracerProvider setup
│   ├── observations.ts       # Observation factory functions
│   ├── persistence.ts        # Span ID file storage
│   └── types.ts              # TypeScript interfaces
```

## Dependencies

### Current

```json
{
  "@langfuse/otel": "^4.4.2",
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-node": "^0.208.0"
}
```

### Proposed Addition

```json
{
  "@langfuse/tracing": "^4.4.2"
}
```

## Risk Assessment

| Risk                     | Mitigation                         |
| ------------------------ | ---------------------------------- |
| Breaking existing traces | Phase 1 is backwards compatible    |
| File I/O performance     | Use async file ops, /tmp for speed |
| Process race conditions  | Use atomic file writes with locks  |
| Span ID collisions       | Use tool_use_id as unique key      |

## Success Metrics

1. **Sessions appear as agents** in Langfuse UI
2. **Subagents nested** under parent session
3. **Tool durations accurate** (PreToolUse → PostToolUse linked)
4. **Type-safe code** with no string attribute keys
5. **Zero data loss** during migration

## References

- [@langfuse/tracing API](https://js.reference.langfuse.com/modules/_langfuse_tracing.html)
- [LangfuseAgent](https://js.reference.langfuse.com/classes/_langfuse_tracing.LangfuseAgent.html)
- [startObservation](https://js.reference.langfuse.com/functions/_langfuse_tracing.startObservation.html)
- [createTraceId](https://js.reference.langfuse.com/functions/_langfuse_tracing.createTraceId.html)
