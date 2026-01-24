# Durable Streams Implementation Gap Analysis

## Executive Summary

This document analyzes the current durable streams implementation against the specification in `/specs/application/integrations/durable-sessions.md`. The implementation provides basic real-time streaming functionality but is missing several capabilities defined in the spec.

**Overall Assessment**: ~50% of spec capabilities implemented

---

## Library Version Upgrade Required ⚠️

The durable streams packages are outdated and should be upgraded to the latest versions.

| Package | Current Version | Latest Version | Gap |
|---------|----------------|----------------|-----|
| `@durable-streams/client` | 0.1.5 | **0.2.0** | Major release |
| `@durable-streams/server` | 0.1.6 | **0.2.0** | Major release |
| `@durable-streams/state` | 0.1.5 | **0.2.0** | Major release |

**Release Date:** January 22, 2025 (see [GitHub Releases](https://github.com/durable-streams/durable-streams/releases))

### New in 0.2.0
- Improved protocol handling
- New `@durable-streams/proxy` package for edge deployment
- Enhanced conformance test suite
- Updated dependency management

### Upgrade Command
```bash
npm install @durable-streams/client@latest @durable-streams/server@latest @durable-streams/state@latest
```

**Note:** Review the [changelog](https://github.com/durable-streams/durable-streams/releases) for breaking changes before upgrading.

---

## Current Implementation Overview

### What's Implemented ✅

| Capability | Implementation |
|------------|----------------|
| **Event Channels** | 6 channels defined (chunks, toolCalls, presence, terminal, workflow, agentState) |
| **SSE Transport** | Native `EventSource` for streaming reads |
| **Offset-Based Storage** | Events stored with monotonic offsets |
| **Basic Resumability** | `subscribe(id, { fromOffset })` supported |
| **Typed Event Publishing** | `DurableStreamsService` with helper methods |
| **Subscriber Error Isolation** | try/catch around subscriber notifications |
| **Basic React Hooks** | `useSession`, `useAgentStream`, `usePresence` |
| **Zod Schema Validation** | `sessionSchema` with all 6 channel schemas |

### Key Implementation Files

| File | Purpose |
|------|---------|
| `src/lib/streams/server.ts` | `InMemoryDurableStreamsServer` - core streaming |
| `src/services/durable-streams.service.ts` | Service wrapper with typed event helpers |
| `src/lib/integrations/durable-streams/schema.ts` | Zod schemas using `createStateSchema` |
| `src/app/hooks/use-session.ts` | React hook for session streaming |
| `src/app/routes/api/sessions/$id/stream.ts` | SSE endpoint |

---

## Gap Analysis

### 1. Client Library Not Used ❌

**Spec Requirement:**
```typescript
import { DurableStreamsClient } from '@durable-streams/client';

const client = new DurableStreamsClient({
  url: '/api/streams',
  schema: sessionSchema,
  reconnect: {
    enabled: true,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },
});
```

**Current Implementation:**
- Uses custom `InMemoryDurableStreamsServer` (server-side)
- Frontend uses raw `EventSource` without client library
- No reconnection configuration

**Impact**: Missing automatic reconnection, client-side schema validation, and standardized subscription management.

---

### 2. No Automatic Reconnection with Backoff ❌

**Spec Requirement:**
- Exponential backoff: initial 1000ms, max 30000ms, multiplier 2
- `onReconnect` callback when connection restored
- Resume from last known offset

**Current Implementation** (`src/app/hooks/use-session.ts:186-188`):
```typescript
eventSource.onerror = () => {
  eventSource.close();  // Just closes, no reconnection
};
```

**Impact**: Clients lose connection permanently on network issues with no recovery.

---

### 3. TanStack DB Collections Missing ❌

**Spec Requirement:**
```typescript
import { createCollection } from '@tanstack/db';

export const chunksCollection = createCollection<ChunkEvent>({
  id: 'session-chunks',
  primaryKey: 'id',
});

// Live queries
const messages = useQuery(messagesCollection, (q) =>
  q.where('sessionId', '==', sessionId).orderBy('timestamp', 'asc')
);
```

**Current Implementation:**
- Uses `useState` for state management
- No TanStack DB integration
- `src/lib/bootstrap/phases/collections.ts` exists but for workflow, not sessions

**Impact**: Missing optimized live queries, derived collections, and efficient state management.

---

### 4. Optimistic Writes Infrastructure Missing ❌

**Spec Requirement:**
```typescript
export async function sendTerminalInput(
  sessionId: string,
  input: string,
  options: {
    onOptimistic: (event: TerminalEvent) => void;
    onConfirm: (event: TerminalEvent, offset: number) => void;
    onRollback: (event: TerminalEvent, error: Error) => void;
  }
): Promise<void>
```

**Current Implementation:**
- No optimistic write functions
- Presence updates are fire-and-forget via POST
- No rollback mechanism

**Impact**: Laggy UI updates, no confirmation of writes, potential data loss without feedback.

---

### 5. Channel Router / Event Multiplexing Missing ❌

**Spec Requirement:**
```typescript
export class SessionEventRouter {
  on<C extends SessionEvent['channel']>(
    channel: C,
    handler: ChannelHandler<Extract<SessionEvent, { channel: C }>>
  ): () => void;

  route(event: SessionEvent): void;
}
```

**Current Implementation:**
- Simple switch statement in `mapEvent` function
- No multi-handler registration
- No dynamic handler add/remove

**Impact**: Less flexible event handling, harder to add new event consumers.

---

### 6. Derived Collections Missing ❌

**Spec Requirement:**
```typescript
export const messagesCollection = createCollection<Message>({
  id: 'session-messages',
  primaryKey: 'id',
  derive: (chunks: ChunkEvent[]) => {
    // Group chunks by agent and turn, aggregate text
  },
});
```

**Current Implementation:**
- No derived collections
- Text aggregation done manually in components

**Impact**: Duplicated aggregation logic, no automatic derived state updates.

---

### 7. useTerminal Hook Missing ❌

**Spec Requirement:**
```typescript
export function useTerminal(sessionId: string): {
  lines: TerminalEvent[];
  inputHistory: string[];
  sendCommand: (command: string) => void;
}
```

**Current Implementation:**
- Terminal events included in `useSession` state
- No dedicated hook with command history
- No `sendCommand` function

**Impact**: No terminal-specific functionality, missing command history.

---

### 8. Presence Heartbeat Interval Wrong ⚠️

**Spec Requirement:** 10-second heartbeat interval
**Current Implementation:** 15-second interval (`src/app/hooks/use-session.ts:209`)

**Impact**: Users may appear offline longer than expected, presence less accurate.

---

### 9. Cursor Throttling Missing ❌

**Spec Requirement:** Cursor updates throttled to 50ms intervals

**Current Implementation:** No throttling implemented

**Impact**: Excessive network traffic, potential performance issues.

---

### 10. Offset Not Returned in POST Responses ❌

**Spec Requirement:**
```typescript
return Response.json({
  ok: true,
  offset: result.offset,  // Required for client tracking
});
```

**Current Implementation:**
- `src/app/routes/api/sessions/$id/presence.ts` returns `{ ok: true }` without offset

**Impact**: Clients can't track write confirmation or implement exactly-once semantics.

---

### 11. No Event Retention Policy ❌

**Spec Requirement:** 30-day event retention

**Current Implementation:**
- In-memory storage only
- Events lost on server restart
- No cleanup mechanism

**Impact**: Data loss on restart, unbounded memory growth in long-running sessions.

---

### 12. Agent-Specific Subscriptions Missing ❌

**Spec Requirement:**
```typescript
export function subscribeToAgent(
  agentId: string,
  callbacks: {
    onState: (state: AgentStateEvent) => void;
    onStep: (step: SessionEvent) => void;
  }
): () => void;
```

**Current Implementation:** No agent-specific subscription function

**Impact**: Can't subscribe to a single agent across sessions.

---

### 13. HTTP POST Write Endpoint Missing ❌

**Spec Requirement:**
```typescript
// POST /api/streams?sessionId=X
POST: async ({ request }) => {
  const { channel, data } = body;
  const result = await streams.append(`session:${sessionId}`, { channel, data });
  return Response.json({ ok: true, offset: result.offset });
}
```

**Current Implementation:**
- Only `/api/sessions/:id/presence` for presence updates
- No general-purpose write endpoint
- No support for terminal input writes

**Impact**: Can't send terminal input via streams, limited write functionality.

---

## Summary Table

| Feature | Spec | Implemented | Priority |
|---------|------|-------------|----------|
| Event Channels (6) | ✅ | ✅ | - |
| SSE Transport | ✅ | ✅ | - |
| Offset Storage | ✅ | ✅ | - |
| Zod Schemas | ✅ | ✅ | - |
| DurableStreamsClient | ✅ | ❌ | High |
| Auto Reconnection | ✅ | ❌ | High |
| TanStack DB Collections | ✅ | ❌ | High |
| Optimistic Writes | ✅ | ❌ | Medium |
| Channel Router | ✅ | ❌ | Medium |
| Derived Collections | ✅ | ❌ | Medium |
| useTerminal Hook | ✅ | ❌ | Low |
| 10s Presence Heartbeat | ✅ | ⚠️ (15s) | Low |
| 50ms Cursor Throttle | ✅ | ❌ | Low |
| Offset in POST Response | ✅ | ❌ | Medium |
| Event Retention | ✅ | ❌ | High |
| Agent Subscriptions | ✅ | ❌ | Low |
| HTTP POST Writes | ✅ | ❌ | Medium |

---

## Recommendations

### High Priority

1. **Implement Reconnection Logic**
   - Add exponential backoff to `useSession` hook
   - Track last offset and resume from it on reconnect
   - Add `onReconnect` callback

2. **Add Event Persistence**
   - Store events in SQLite alongside in-memory
   - Implement 30-day retention with cleanup
   - Support replay from database on server restart

3. **Integrate TanStack DB**
   - Create collections as specified
   - Replace useState with useQuery
   - Add derived messagesCollection

### Medium Priority

4. **Implement Optimistic Writes**
   - Create `sendTerminalInput()` function
   - Add write manager for retry/rollback
   - Return offset in POST responses

5. **Add HTTP POST Write Endpoint**
   - Create `/api/streams` POST handler
   - Support all channel types
   - Return offset for confirmation

6. **Add Channel Router**
   - Implement `SessionEventRouter` class
   - Support multiple handlers per channel
   - Enable dynamic subscription management

### Low Priority

7. **Fix Presence Heartbeat** - Change from 15s to 10s
8. **Add Cursor Throttling** - Implement 50ms debounce
9. **Create useTerminal Hook** - Extract terminal-specific logic
10. **Add Agent Subscriptions** - Support cross-session agent tracking

---

## Appendix: File References

### Backend
- `src/lib/streams/server.ts:40-199` - InMemoryDurableStreamsServer
- `src/services/durable-streams.service.ts:227-425` - Service wrapper
- `src/app/routes/api/sessions/$id/stream.ts` - SSE endpoint
- `src/lib/bootstrap/phases/streams.ts` - Bootstrap initialization

### Frontend
- `src/app/hooks/use-session.ts:128-217` - Main session hook
- `src/app/hooks/use-agent-stream.ts` - Agent streaming hook
- `src/app/hooks/use-presence.ts` - Presence polling hook
- `src/app/components/features/agent-session-view/` - UI components

### Schemas
- `src/lib/integrations/durable-streams/schema.ts` - All 6 channel schemas
- `src/services/durable-streams.service.ts:14-67` - Event type definitions

### Spec
- `specs/application/integrations/durable-sessions.md` - Full specification
