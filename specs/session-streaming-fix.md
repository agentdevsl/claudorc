# Plan: Fix Session Streaming and Event Persistence

## Problem Summary

Two issues preventing streaming from working:

1. **Agent-runner crashes with EPIPE** - The Claude Agent SDK subprocess crashes within 1ms of starting, causing an unhandled EPIPE error
2. **Events not persisted to database** - Container agent events are published to DurableStreams (in-memory) but NOT saved to the `session_events` table

## Root Causes

### Issue 1: EPIPE Crash
- Agent-runner at `agent-runner/src/index.ts` calls `session.stream()` without proper error handling
- The SDK subprocess crashes (likely during initialization)
- The parent process tries to write to a closed pipe → EPIPE
- The error isn't caught, process crashes silently

### Issue 2: Missing Event Persistence
- Container agent events use `streams.publish()` directly (bypasses database)
- The `session_events` table EXISTS but isn't being populated
- `/api/sessions/:id/events` reads from DB → returns 0 events
- SSE `/api/sessions/:id/stream` reads from DurableStreams → has events (temporarily)

---

## Implementation Plan

### Step 1: Add Event Persistence (Follow Task Creation Pattern)

**File: `src/services/durable-streams.service.ts`**

Modify the `publish()` method to persist events synchronously to database BEFORE publishing to in-memory stream:

```typescript
async publish<T extends TypedEventType>(
  sessionId: string,
  type: T,
  data: StreamEventMap[T]
): Promise<number> {
  const timestamp = Date.now();
  const eventId = createId();

  // Get next offset for this session
  const lastEvent = await this.db.query.sessionEvents.findFirst({
    where: eq(sessionEvents.sessionId, sessionId),
    orderBy: [desc(sessionEvents.offset)],
  });
  const offset = (lastEvent?.offset ?? -1) + 1;

  // PERSIST TO DATABASE FIRST (synchronous, like task creation)
  await this.db.insert(sessionEvents).values({
    id: eventId,
    sessionId,
    offset,
    type,
    channel: this.getChannelForType(type),
    data: data as unknown,
    timestamp,
  });

  // THEN publish to in-memory stream for real-time delivery
  const server = this.getServer();
  server.publish(sessionId, { type, data, timestamp, offset });

  return offset;
}
```

**File: `src/db/schema/session-events.ts`** - Already exists, no changes needed

### Step 2: Fix Agent-Runner Error Handling

**File: `agent-runner/src/index.ts`**

Wrap the stream processing in proper try/catch with explicit error event:

```typescript
try {
  // Send the initial prompt
  await session.send(config.prompt as string);

  // Process the stream with explicit error handling
  console.error('[agent-runner] Processing SDK stream...');

  for await (const msg of session.stream()) {
    // ... existing message handling ...
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('[agent-runner] Stream error:', message);

  // Emit error event before exiting
  events.error({
    error: message,
    code: 'STREAM_ERROR',
    turnCount: turn,
  });

  process.exit(1);
}
```

### Step 3: Add Global Unhandled Error Handler

**File: `agent-runner/src/index.ts`**

Add at the top of the file to catch EPIPE and other unhandled errors:

```typescript
// Handle uncaught errors (including EPIPE from SDK)
process.on('uncaughtException', (error) => {
  console.error('[agent-runner] Uncaught exception:', error.message);

  // Try to emit error event if we have config
  if (config.taskId && config.sessionId) {
    const events = createEventEmitter(config.taskId, config.sessionId);
    events.error({
      error: `Uncaught: ${error.message}`,
      code: error.code || 'UNCAUGHT_ERROR',
      turnCount: 0,
    });
  }

  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[agent-runner] Unhandled rejection:', reason);
  process.exit(1);
});
```

### Step 4: Update Container-Agent Service to Await Persistence

**File: `src/services/container-agent.service.ts`**

Change fire-and-forget publishes to await completion for critical events:

```typescript
// BEFORE (fire-and-forget - events may be lost):
void this.streams.publish(sessionId, 'container-agent:status', {...});

// AFTER (awaited - events are persisted):
await this.streams.publish(sessionId, 'container-agent:status', {...});
```

Keep fire-and-forget only for high-frequency token events where some loss is acceptable.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/services/durable-streams.service.ts` | Add DB persistence in `publish()` |
| `agent-runner/src/index.ts` | Add error handling + uncaught exception handler |
| `src/services/container-agent.service.ts` | Await critical event publishes |

## Verification

1. **Test Event Persistence**:
   ```bash
   # Move a task to in_progress
   # Check events are persisted:
   curl http://localhost:3001/api/sessions/{sessionId}/events
   # Should return events, not empty array
   ```

2. **Test Error Handling**:
   - Check server logs for `[agent-runner] Uncaught exception:` message
   - Verify error event is published even when agent crashes
   - UI should show error state instead of hanging on "Running"

3. **Test Streaming**:
   - Move task to in_progress
   - Agent Output section should show streaming text
   - Events should persist and be retrievable after page refresh

## Notes

- The EPIPE root cause may be credential format or SDK compatibility issue
- Even if EPIPE still occurs, the uncaught exception handler will emit proper error events
- Event persistence ensures history is available even after server restart
