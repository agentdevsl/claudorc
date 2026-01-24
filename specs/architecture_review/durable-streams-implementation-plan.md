# Durable Streams Implementation Plan

This document outlines the recommended implementation plan to bring the durable streams implementation into full alignment with the specification at `specs/application/integrations/durable-sessions.md`.

---

## Phase 0: Prerequisites

### 0.1 Upgrade Durable Streams Packages

**Files to Modify:**
- `package.json`

**Current Versions:**
| Package | Current | Target |
|---------|---------|--------|
| `@durable-streams/client` | 0.1.5 | 0.2.0 |
| `@durable-streams/server` | 0.1.6 | 0.2.0 |
| `@durable-streams/state` | 0.1.5 | 0.2.0 |

**Steps:**
1. Review [changelog](https://github.com/durable-streams/durable-streams/releases) for breaking changes
2. Run upgrade command: `npm install @durable-streams/client@0.2.0 @durable-streams/server@0.2.0 @durable-streams/state@0.2.0`
3. Run tests to verify no regressions
4. Update any imports if API changes occurred

**New in 0.2.0:**
- Improved protocol handling
- New `@durable-streams/proxy` package for edge deployment
- Enhanced conformance test suite

**Estimated Effort:** 1-2 hours

---

## Phase 1: High Priority - Core Reliability

### 1.1 Implement Reconnection Logic

**Files to Modify:**
- `src/app/hooks/use-session.ts`
- `src/app/hooks/use-agent-stream.ts`

**Implementation:**
```typescript
// Add to useSession hook
const reconnect = {
  enabled: true,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

let reconnectAttempts = 0;
let lastOffset = 0;

eventSource.onerror = () => {
  eventSource.close();

  const delay = Math.min(
    reconnect.initialDelay * Math.pow(reconnect.backoffMultiplier, reconnectAttempts),
    reconnect.maxDelay
  );

  setTimeout(() => {
    reconnectAttempts++;
    // Reconnect with last known offset
    const newEventSource = new EventSource(
      `/api/sessions/${sessionId}/stream?fromOffset=${lastOffset}`
    );
  }, delay);
};

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  lastOffset = data.offset ?? lastOffset + 1;
  // ...existing handling
};
```

**Estimated Effort:** 2-3 hours

---

### 1.2 Add Event Persistence

**Files to Create:**
- `src/lib/streams/persistent-server.ts`

**Files to Modify:**
- `src/lib/db/schema.ts` - Add stream_events table
- `src/lib/streams/server.ts` - Extend with persistence
- `src/lib/bootstrap/phases/streams.ts` - Load from DB on startup

**Database Schema:**
```typescript
export const streamEvents = sqliteTable('stream_events', {
  id: text('id').primaryKey(),
  streamId: text('stream_id').notNull(),
  offset: integer('offset').notNull(),
  type: text('type').notNull(),
  data: text('data', { mode: 'json' }).notNull(),
  timestamp: integer('timestamp').notNull(),
  expiresAt: integer('expires_at').notNull(), // 30 days from creation
});
```

**Implementation:**
- Write events to both memory and SQLite
- Load events from SQLite on server startup
- Add cleanup job for events older than 30 days
- Index on (streamId, offset) for efficient replay

**Estimated Effort:** 4-6 hours

---

### 1.3 Integrate TanStack DB Collections

**Files to Create:**
- `src/lib/sessions/collections.ts`
- `src/lib/sessions/sync.ts`

**Files to Modify:**
- `src/app/hooks/use-session.ts` - Replace useState with useQuery
- `src/lib/bootstrap/phases/collections.ts` - Add session collections

**Implementation:**
```typescript
// src/lib/sessions/collections.ts
import { createCollection } from '@tanstack/db';

export const chunksCollection = createCollection<ChunkEvent>({
  id: 'session-chunks',
  primaryKey: 'id',
});

export const toolCallsCollection = createCollection<ToolCallEvent>({
  id: 'session-tool-calls',
  primaryKey: 'id',
});

// ... other collections

// Derived messages collection
export const messagesCollection = createCollection<Message>({
  id: 'session-messages',
  primaryKey: 'id',
  derive: (chunks: ChunkEvent[]) => {
    const messages = new Map<string, Message>();
    for (const chunk of chunks) {
      const key = `${chunk.agentId}-${chunk.turn ?? 0}`;
      // Aggregate chunks into messages
    }
    return Array.from(messages.values());
  },
});
```

**Estimated Effort:** 4-6 hours

---

## Phase 2: Medium Priority - Enhanced Functionality

### 2.1 Implement Optimistic Writes

**Files to Create:**
- `src/lib/sessions/optimistic.ts`
- `src/lib/sessions/optimistic-manager.ts`

**Implementation:**
```typescript
// src/lib/sessions/optimistic.ts
export async function sendTerminalInput(
  sessionId: string,
  input: string,
  options: {
    onOptimistic: (event: TerminalEvent) => void;
    onConfirm: (event: TerminalEvent, offset: number) => void;
    onRollback: (event: TerminalEvent, error: Error) => void;
  }
): Promise<void> {
  const optimisticEvent = createTerminalEvent(sessionId, 'input', input, 'user');

  options.onOptimistic(optimisticEvent);

  try {
    const response = await fetch(`/api/streams?sessionId=${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'terminal', data: optimisticEvent }),
    });

    const result = await response.json();
    options.onConfirm(optimisticEvent, result.offset);
  } catch (error) {
    options.onRollback(optimisticEvent, error as Error);
  }
}
```

**Estimated Effort:** 3-4 hours

---

### 2.2 Add HTTP POST Write Endpoint

**Files to Create:**
- `src/app/routes/api/streams/index.ts` (or modify existing)

**Implementation:**
```typescript
// POST /api/streams
export const ServerRoute = createServerFileRoute().methods({
  POST: async ({ request }) => {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      return new Response('Missing sessionId', { status: 400 });
    }

    const { channel, data } = await request.json();

    const server = getStreamProvider();
    await server.publish(sessionId, channel, {
      ...data,
      id: data.id ?? createId(),
      timestamp: data.timestamp ?? Date.now(),
    });

    const offset = server.getCurrentOffset(sessionId);

    return Response.json({ ok: true, offset });
  },
});
```

**Estimated Effort:** 2-3 hours

---

### 2.3 Implement Channel Router

**Files to Create:**
- `src/lib/sessions/router.ts`
- `src/lib/sessions/multiplexer.ts`

**Implementation:**
```typescript
// src/lib/sessions/router.ts
export class SessionEventRouter {
  private handlers = new Map<string, Set<ChannelHandler>>();

  on<C extends SessionEvent['channel']>(
    channel: C,
    handler: ChannelHandler<Extract<SessionEvent, { channel: C }>>
  ): () => void {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set());
    }
    this.handlers.get(channel)!.add(handler);

    return () => this.handlers.get(channel)?.delete(handler);
  }

  route(event: SessionEvent): void {
    const handlers = this.handlers.get(event.channel);
    handlers?.forEach(handler => handler(event));
  }
}
```

**Estimated Effort:** 2-3 hours

---

### 2.4 Return Offset in Responses

**Files to Modify:**
- `src/app/routes/api/sessions/$id/presence.ts`
- Any other POST endpoints that write to streams

**Implementation:**
```typescript
// Add to response
return Response.json({
  ok: true,
  offset: server.getCurrentOffset(sessionId),
});
```

**Estimated Effort:** 1 hour

---

## Phase 3: Low Priority - Polish

### 3.1 Fix Presence Heartbeat

**Files to Modify:**
- `src/app/hooks/use-session.ts:209`

**Change:**
```typescript
// From
const interval = window.setInterval(updatePresence, 15000);
// To
const interval = window.setInterval(updatePresence, 10000);
```

**Estimated Effort:** 5 minutes

---

### 3.2 Add Cursor Throttling

**Files to Modify:**
- `src/app/hooks/use-presence.ts` (or create new function)

**Implementation:**
```typescript
import { useMemo } from 'react';

// Throttle function
function throttle<T extends (...args: any[]) => void>(fn: T, delay: number): T {
  let lastCall = 0;
  return ((...args) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

// In hook
const updateCursor = useMemo(
  () => throttle((cursor: { x: number; y: number }) => {
    sendPresenceUpdate(sessionId, userId, cursor, { onOptimistic: () => {} });
  }, 50),
  [sessionId, userId]
);
```

**Estimated Effort:** 30 minutes

---

### 3.3 Create useTerminal Hook

**Files to Create:**
- `src/app/hooks/use-terminal.ts`

**Implementation:**
```typescript
export function useTerminal(sessionId: string): UseTerminalResult {
  const lines = useQuery(terminalCollection, (q) =>
    q.where('sessionId', '==', sessionId).orderBy('timestamp', 'asc')
  );

  const inputHistory = useMemo(() =>
    lines
      .filter(l => l.type === 'input' && l.source === 'user')
      .map(l => l.data)
      .reverse()
      .slice(0, 50),
    [lines]
  );

  const sendCommand = useCallback((command: string) => {
    sendTerminalInput(sessionId, command, {
      onOptimistic: (event) => terminalCollection.insert(event),
      onConfirm: () => {},
      onRollback: (event) => terminalCollection.delete(event.id),
    });
  }, [sessionId]);

  return { lines, inputHistory, sendCommand };
}
```

**Estimated Effort:** 1-2 hours

---

### 3.4 Add Agent-Specific Subscriptions

**Files to Create:**
- `src/lib/streams/agent-subscription.ts`

**Implementation:**
```typescript
export function subscribeToAgent(
  agentId: string,
  callbacks: {
    onState: (state: AgentStateEvent) => void;
    onStep: (step: SessionEvent) => void;
  }
): () => void {
  return client.subscribe(`agent:${agentId}`, (event) => {
    if (event.channel === 'agentState') {
      callbacks.onState(event.data);
    } else {
      callbacks.onStep(event);
    }
  });
}
```

**Estimated Effort:** 1-2 hours

---

## Implementation Order

| Order | Task | Effort | Dependencies |
|-------|------|--------|--------------|
| 0 | 0.1 Upgrade Packages | 1-2h | None (do first) |
| 1 | 1.1 Reconnection Logic | 2-3h | 0.1 |
| 2 | 1.2 Event Persistence | 4-6h | 0.1 |
| 3 | 2.2 HTTP POST Write Endpoint | 2-3h | 0.1 |
| 4 | 2.4 Return Offset in Responses | 1h | 2.2 |
| 5 | 2.1 Optimistic Writes | 3-4h | 2.2, 2.4 |
| 6 | 1.3 TanStack DB Collections | 4-6h | 0.1 |
| 7 | 2.3 Channel Router | 2-3h | 0.1 |
| 8 | 3.1 Fix Presence Heartbeat | 5m | None |
| 9 | 3.2 Cursor Throttling | 30m | None |
| 10 | 3.3 useTerminal Hook | 1-2h | 1.3, 2.1 |
| 11 | 3.4 Agent Subscriptions | 1-2h | 0.1 |

**Total Estimated Effort:** 23-34 hours

---

## Verification Checklist

After implementation, verify:

- [ ] Durable streams packages upgraded to 0.2.0
- [ ] Reconnection works on network disconnect (toggle wifi)
- [ ] Events persist across server restarts
- [ ] Events older than 30 days are cleaned up
- [ ] TanStack DB queries work with live updates
- [ ] Optimistic writes show immediately in UI
- [ ] Write errors trigger rollback
- [ ] POST endpoint returns offset
- [ ] Presence heartbeat is 10 seconds
- [ ] Cursor updates are throttled to 50ms
- [ ] Terminal hook provides command history
- [ ] Agent subscriptions work across sessions
