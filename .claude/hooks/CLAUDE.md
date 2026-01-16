# Claude Code Langfuse Hook - Development Guide

## Architecture Overview

This hook integrates Claude Code with Langfuse for observability. It tracks tool executions, errors, and session health using the Langfuse v4 SDK.

### Key Components

| File                          | Purpose                                      |
| ----------------------------- | -------------------------------------------- |
| `src/langfuse-hook.ts`        | Main hook entry point, event processing      |
| `src/tracing/provider.ts`     | Langfuse client initialization and lifecycle |
| `src/tracing/observations.ts` | Observation creation and finalization        |
| `src/tracing/scores.ts`       | Failure tracking score recording             |
| `src/tracing/persistence.ts`  | Cross-process state management               |
| `src/tracing/types.ts`        | TypeScript interfaces                        |
| `src/utils.ts`                | Event parsing and error analysis             |

## Failure Tracking System

### How Scores Work

Scores are recorded automatically for each tool execution:

1. **PreToolUse**: Creates observation, captures start time
2. **PostToolUse**: Finalizes observation, records scores
3. **Stop**: Records session-level health scores

### Score Types

```typescript
// Tool-level (per observation)
tool_success: 0 | 1; // Boolean
failure_category: string; // Categorical (error types)
error_severity: number; // Numeric (0.0-1.0)
is_cascade_failure: 0 | 1; // Boolean

// Session-level (on Stop)
session_success_rate: number; // Numeric (0.0-1.0)
session_health: string; // Categorical
dominant_failure_mode: string; // Categorical
```

### Cascade Failure Detection

The hook tracks tool chain context to detect cascade failures:

```typescript
// In persistence.ts
interface ToolChainState {
  chainPosition: number;
  lastToolName?: string;
  lastToolSuccess?: boolean;
}
```

If the preceding tool failed, any subsequent failure is marked with `is_cascade_failure = 1`.

## Cross-Process Architecture

Claude Code runs hooks in separate processes. State is persisted to `/tmp/langfuse-spans-*.json`:

```
PreToolUse (Process A)     PostToolUse (Process B)
       |                          |
       v                          v
  saveSpanState()            loadSpanState()
       |                          |
       +--- /tmp/spans.json ------+
```

### Idempotency

Scores use idempotency keys to prevent duplicates:

```typescript
const scoreId = `${observationId}-${scoreName}`;
```

## Debugging

### Enable Debug Logging

```bash
export LANGFUSE_LOG_LEVEL=DEBUG
```

### Check Debug Log

```bash
tail -f /tmp/langfuse-hook-debug.log
```

### Verify Scores via API

```javascript
// check-scores.cjs
const scores = await fetch(`${host}/api/public/scores?traceId=${traceId}`);
```

## Common Issues

### Scores Not Appearing

1. Check `getLangfuseClient()` returns non-null
2. Verify `flushScores()` is called before process exit
3. Check debug log for recording errors

### Duplicate Observations

1. Check event deduplication via `hasProcessedEvent()`
2. Verify `tool_use_id` is consistent across Pre/PostToolUse

### Cross-Process Linking Failures

1. Check `/tmp/langfuse-spans-*.json` files exist
2. Verify traceparent format: `00-{traceId}-{spanId}-01`
3. Check session persistence via `getSessionInfo()`

## Testing

```bash
npm test                    # Run all tests (167 tests)
npm test scores.test        # Score functions
npm test observations.test  # Status formatting
npm test persistence.test   # Cross-process state
```

## Adding New Score Types

1. Add constant to `src/tracing/scores.ts`:

   ```typescript
   export const SCORE_NEW_METRIC = 'new_metric';
   ```

2. Create recording function:

   ```typescript
   export async function recordNewMetricScore(
     langfuse: LangfuseClient,
     traceId: string,
     observationId: string,
     value: number
   ): Promise<void> {
     await recordScore({
       langfuse,
       traceId,
       observationId,
       name: SCORE_NEW_METRIC,
       value,
       dataType: 'NUMERIC',
     });
   }
   ```

3. Call from `langfuse-hook.ts` in PostToolUse handler

4. Export from `src/tracing/index.ts`

5. Add tests in `scores.test.ts`
