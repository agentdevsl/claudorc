# Durable Streams Architecture

This document describes the architecture of the Durable Streams system used for real-time event streaming and session persistence in AgentPane.

## Overview

Durable Streams provides a unified system for:

- Real-time event streaming during active sessions
- Persistent event storage for historical replay
- Offset-based resumability for reconnection handling
- Multi-channel event categorization
- Optimistic UI updates with rollback support
- TanStack DB collections for reactive state

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                         React Components                                     ││
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  ││
│  │  │ AgentSessionView│  │  TerminalView   │  │    SessionHistoryPage       │  ││
│  │  │ StreamView      │  │  PresenceCursor │  │    ReplayControls           │  ││
│  │  │ ToolCallsPanel  │  │                 │  │    StreamViewer             │  ││
│  │  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  ││
│  └───────────┼────────────────────┼─────────────────────────┼──────────────────┘│
│              │                    │                         │                    │
│              ▼                    ▼                         ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                           React Hooks                                        ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │ useSession(sessionId, userId)                                           │││
│  │  │  • Manages connection state (disconnected/connecting/connected)         │││
│  │  │  • Routes events to state arrays (chunks, toolCalls, presence, etc.)    │││
│  │  │  • Handles presence join/leave lifecycle                                │││
│  │  │  • 10-second presence heartbeat                                         │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └───────────┬─────────────────────────────────────────────────────────────────┘│
│              │                                                                   │
│              ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      TanStack DB Collections                                 ││
│  │  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐  ││
│  │  │  chunks   │ │ toolCalls │ │ presence  │ │ terminal  │ │  agentState   │  ││
│  │  │Collection │ │Collection │ │Collection │ │Collection │ │  Collection   │  ││
│  │  └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └───────┬───────┘  ││
│  │        └─────────────┴─────────────┴─────────────┴───────────────┘          ││
│  │                                    ▲                                         ││
│  │                    syncSessionToCollections()                                ││
│  └────────────────────────────────────┬────────────────────────────────────────┘│
│                                       │                                          │
│  ┌────────────────────────────────────┼────────────────────────────────────────┐│
│  │              DurableStreamsClient  │                                         ││
│  │  ┌─────────────────────────────────┴───────────────────────────────────────┐││
│  │  │ • EventSource connection to /api/streams/:id/subscribe                  │││
│  │  │ • Automatic reconnection with exponential backoff (1s → 30s)            │││
│  │  │ • Offset tracking for resume (lastOffset sent on reconnect)             │││
│  │  │ • Maps raw events → typed channel events                                │││
│  │  │ • Routes to callbacks: onChunk, onToolCall, onPresence, etc.            │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                        Optimistic Writes                                     ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │ sendTerminalInput()  - Optimistic insert → POST → confirm/rollback      │││
│  │  │ sendPresenceUpdate() - Throttled 50ms → fire-and-forget POST            │││
│  │  │ sendPresenceJoin()   - Insert → POST to /api/sessions/:id/presence      │││
│  │  │ sendPresenceLeave()  - Delete → POST to /api/sessions/:id/presence      │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        │  HTTP REST / SSE
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────┐     ┌─────────────────────────────────────┐│
│  │         REST Endpoints          │     │          SSE Endpoints              ││
│  │  ┌───────────────────────────┐  │     │  ┌───────────────────────────────┐  ││
│  │  │ POST /api/streams         │  │     │  │ GET /api/streams/:id/subscribe│  ││
│  │  │   ?sessionId=xxx          │  │     │  │     ?fromOffset=N             │  ││
│  │  │   Body: {channel, data}   │  │     │  │                               │  ││
│  │  │   Returns: {ok, offset}   │  │     │  │  • Sends "connected" event    │  ││
│  │  │   Auth: withAuth()        │◄─┼─────┼──│  • Yields events with offset  │  ││
│  │  │   Validates: presence     │  │     │  │  • Supports resume from offset│  ││
│  │  │     userId ownership      │  │     │  └───────────────────────────────┘  ││
│  │  └───────────────────────────┘  │     │                                     ││
│  │                                 │     │  ┌───────────────────────────────┐  ││
│  │  ┌───────────────────────────┐  │     │  │ GET /api/streams/:id          │  ││
│  │  │ GET /api/sessions         │  │     │  │   ?fromOffset=0&limit=100     │  ││
│  │  │ GET /api/sessions/:id     │  │     │  │   Returns: metadata + events  │  ││
│  │  │ GET /api/sessions/:id/    │  │     │  └───────────────────────────────┘  ││
│  │  │     events                │  │     │                                     ││
│  │  │ GET /api/sessions/:id/    │  │     │                                     ││
│  │  │     summary               │  │     │                                     ││
│  │  └───────────────────────────┘  │     │                                     ││
│  └─────────────────────────────────┘     └─────────────────────────────────────┘│
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                        Auth Middleware                                       ││
│  │  ┌─────────────────────────────────────────────────────────────────────────┐││
│  │  │ getAuthContext(request) - Extract auth from cookie/header/dev-mode      │││
│  │  │ withAuth(handler)       - Wrapper requiring authentication              │││
│  │  │ validateUserIdMatch()   - Prevent presence userId spoofing              │││
│  │  └─────────────────────────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                      SessionService (Facade)                                 ││
│  │  Coordinates three focused services:                                         ││
│  │                                                                              ││
│  │  ┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────────┐││
│  │  │ SessionCrudService  │ │SessionPresenceService│ │ SessionStreamService   │││
│  │  │                     │ │                     │ │                         │││
│  │  │ • create(input)     │ │ • join(session,user)│ │ • publish(session,event)│││
│  │  │ • getById(id)       │ │ • leave(session,user│ │ • subscribe(session)    │││
│  │  │ • list(options)     │ │ • updatePresence()  │ │ • persistEvent()        │││
│  │  │ • close(id)         │ │ • getActiveUsers()  │ │ • getHistory()          │││
│  │  │ • listWithFilters() │ │                     │ │ • getEventsBySession()  │││
│  │  │                     │ │                     │ │ • getSessionSummary()   │││
│  │  └─────────────────────┘ └─────────────────────┘ └─────────────────────────┘││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│                                                                                  │
└───────────────────────────────────────┬─────────────────────────────────────────┘
                                        │
                ┌───────────────────────┴───────────────────┐
                ▼                                           ▼
┌───────────────────────────────────────┐   ┌───────────────────────────────────────┐
│     DURABLE STREAMS LAYER             │   │           DATABASE LAYER              │
├───────────────────────────────────────┤   ├───────────────────────────────────────┤
│                                       │   │                                       │
│  ┌─────────────────────────────────┐  │   │  ┌─────────────────────────────────┐ │
│  │ InMemoryDurableStreamsServer    │  │   │  │         SQLite Database         │ │
│  │                                 │  │   │  │                                 │ │
│  │  Interface:                     │  │   │  │  ┌───────────────────────────┐  │ │
│  │  ┌───────────────────────────┐  │  │   │  │  │     session_events        │  │ │
│  │  │ createStream(id, schema)  │  │  │   │  │  │  ├─ id (PK)               │  │ │
│  │  │ publish(id, type, data)   │──┼──┼───┼──┼──│  ├─ session_id (FK)       │  │ │
│  │  │   → returns offset        │  │  │   │  │  │  ├─ offset (sequential)   │  │ │
│  │  │ subscribe(id, options)    │  │  │   │  │  │  ├─ type                  │  │ │
│  │  │   → AsyncIterable<Event>  │  │  │   │  │  │  ├─ channel              │  │ │
│  │  │ getEvents(id, options)    │  │  │   │  │  │  ├─ data (JSON)          │  │ │
│  │  │ deleteStream(id)          │  │  │   │  │  │  ├─ timestamp            │  │ │
│  │  └───────────────────────────┘  │  │   │  │  │  └─ created_at           │  │ │
│  │                                 │  │   │  │  └───────────────────────────┘  │ │
│  │  In-Memory Storage:             │  │   │  │                                 │ │
│  │  ┌───────────────────────────┐  │  │   │  │  ┌───────────────────────────┐  │ │
│  │  │ Map<streamId, {           │  │  │   │  │  │    session_summaries      │  │ │
│  │  │   events: StoredEvent[],  │  │  │   │  │  │  ├─ id (PK)               │  │ │
│  │  │   subscribers: Set,       │  │  │   │  │  │  ├─ session_id (FK,UQ)    │  │ │
│  │  │   schema                  │  │  │   │  │  │  ├─ duration_ms           │  │ │
│  │  │ }>                        │  │  │   │  │  │  ├─ turns_count           │  │ │
│  │  └───────────────────────────┘  │  │   │  │  │  ├─ tokens_used           │  │ │
│  │                                 │  │   │  │  │  ├─ files_modified        │  │ │
│  │  StoredEvent:                   │  │   │  │  │  ├─ lines_added           │  │ │
│  │  { offset, type, data, ts }     │  │   │  │  │  ├─ lines_removed         │  │ │
│  └─────────────────────────────────┘  │   │  │  │  └─ final_status          │  │ │
│                                       │   │  │  └───────────────────────────┘  │ │
└───────────────────────────────────────┘   │  └─────────────────────────────────┘ │
                                            └───────────────────────────────────────┘
```

## Event Channels

The system supports six distinct event channels, each with its own Zod schema:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SESSION EVENT SCHEMA                                │
│                        (src/lib/sessions/schema.ts)                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  chunks    │  │ toolCalls  │  │  presence  │  │  terminal  │             │
│  │            │  │            │  │            │  │            │             │
│  │ • id       │  │ • id       │  │ • userId   │  │ • id       │             │
│  │ • agentId? │  │ • agentId? │  │ • sessionId│  │ • sessionId│             │
│  │ • sessionId│  │ • sessionId│  │ • cursor?  │  │ • type     │             │
│  │ • text     │  │ • tool     │  │ • lastSeen │  │   (input/  │             │
│  │ • accum?   │  │ • input    │  │ • joinedAt?│  │    output) │             │
│  │ • turn?    │  │ • output?  │  │ • display  │  │ • data     │             │
│  │ • timestamp│  │ • status   │  │   Name?    │  │ • source?  │             │
│  │            │  │   (running/│  │ • avatar   │  │ • timestamp│             │
│  │            │  │    complete│  │   Url?     │  │            │             │
│  │            │  │    error)  │  │            │  │            │             │
│  │            │  │ • duration?│  │            │  │            │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                             │
│  │  workflow  │  │ agentState │  │  messages  │                             │
│  │            │  │            │  │ (derived)  │                             │
│  │ • id       │  │ • agentId  │  │            │                             │
│  │ • sessionId│  │ • sessionId│  │ • id       │                             │
│  │ • taskId?  │  │ • status   │  │ • agentId  │                             │
│  │ • type     │  │   (idle/   │  │ • sessionId│                             │
│  │ • payload  │  │    running/│  │ • text     │                             │
│  │ • actor?   │  │    complete│  │ • turn     │                             │
│  │ • timestamp│  │    error)  │  │ • timestamp│                             │
│  │            │  │ • taskId?  │  │            │                             │
│  │            │  │ • turn?    │  │            │                             │
│  │            │  │ • progress?│  │            │                             │
│  │            │  │ • message? │  │            │                             │
│  │            │  │ • error?   │  │            │                             │
│  └────────────┘  └────────────┘  └────────────┘                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Event Type Mapping

Server event types map to client channels:

| Server Event Type | Client Channel | Description |
|-------------------|----------------|-------------|
| `chunk` | `chunks` | Text streaming from agent |
| `tool:start` | `toolCalls` | Tool execution started |
| `tool:result` | `toolCalls` | Tool execution completed |
| `presence:joined` | `presence` | User joined session |
| `presence:left` | `presence` | User left session |
| `presence:cursor` | `presence` | Cursor position update |
| `terminal:input` | `terminal` | User terminal input |
| `terminal:output` | `terminal` | Agent terminal output |
| `state:update` | `agentState` | Agent lifecycle state |
| `workflow` | `workflow` | Approval workflow events |

## Data Flow

### Real-time Streaming (Active Sessions)

```
┌─────────┐    ┌───────────────────┐    ┌───────────────┐    ┌────────────────┐
│  Agent  │───►│  SessionStream    │───►│    Durable    │───►│   Subscriber   │
│  SDK    │    │  Service.publish()│    │    Streams    │    │   (SSE)        │
└─────────┘    └───────────────────┘    └───────────────┘    └────────────────┘
     │               │                         │                    │
     │  emit event   │  publish()              │  notify            │  yield event
     │──────────────►│────────────────────────►│───────────────────►│
     │               │                         │                    │
     │               │  persistEvent() async   │                    │
     │               │──────────┐              │                    │
     │               │          ▼              │                    │
     │               │    ┌──────────┐         │                    │
     │               │    │ SQLite   │         │                    │
     │               │    │ Events   │         │                    │
     │               │    └──────────┘         │                    │
     │               │                         │                    │
```

### Client Write Flow (Optimistic Updates)

```
┌─────────┐    ┌───────────────────┐    ┌───────────────┐    ┌────────────────┐
│  User   │───►│  Optimistic       │───►│  POST /api/   │───►│  SessionStream │
│  Action │    │  Write            │    │  streams      │    │  Service       │
└─────────┘    └───────────────────┘    └───────────────┘    └────────────────┘
     │               │                         │                    │
     │  input        │  1. Insert to           │                    │
     │──────────────►│     collection          │                    │
     │               │  2. POST request        │                    │
     │               │────────────────────────►│                    │
     │               │                         │  3. Validate auth  │
     │               │                         │  4. publish()      │
     │               │                         │───────────────────►│
     │               │                         │                    │
     │               │  5a. Success: confirm   │◄───────────────────│
     │               │◄────────────────────────│  {ok, offset}      │
     │               │                         │                    │
     │               │  5b. Failure: rollback  │                    │
     │               │     (delete from coll.) │                    │
```

### Historical Replay (Closed Sessions)

```
┌────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌────────────────┐
│  History   │───►│  API Endpoint │───►│  SessionStream  │───►│     SQLite     │
│    UI      │    │  /events      │    │  Service        │    │    Database    │
└────────────┘    └───────────────┘    └─────────────────┘    └────────────────┘
     │                   │                      │                     │
     │  fetch events     │  GET request         │  getEventsBySession │  query
     │──────────────────►│─────────────────────►│────────────────────►│
     │                   │                      │                     │
     │  paginated events │◄─────────────────────│◄────────────────────│
     │◄──────────────────│                      │                     │
     │                   │                      │                     │
```

## Key Components

### 1. DurableStreamsClient (`src/lib/streams/client.ts`)

Client-side EventSource wrapper providing:

- Automatic reconnection with exponential backoff (1s → 30s)
- Offset tracking for seamless resume after disconnect
- Typed event callbacks for each channel
- Connection state management

```typescript
interface DurableStreamsClient {
  subscribeToSession(sessionId: string, callbacks: SessionCallbacks): Subscription;
  subscribeToAgent(agentId: string, callbacks: AgentCallbacks): Subscription;
}

interface Subscription {
  unsubscribe(): void;
  getState(): ConnectionState;  // disconnected | connecting | connected | reconnecting
  getLastOffset(): number;
}
```

### 2. TanStack DB Collections (`src/lib/sessions/collections.ts`)

Local-only reactive collections for UI state:

| Collection | Primary Key | Purpose |
|------------|-------------|---------|
| `chunksCollection` | `id` | Raw streaming text |
| `toolCallsCollection` | `id` | Tool execution tracking |
| `presenceCollection` | `${sessionId}:${userId}` | Active users |
| `terminalCollection` | `id` | Terminal I/O |
| `workflowCollection` | `id` | Approval workflow |
| `agentStateCollection` | `${sessionId}:${agentId}` | Agent lifecycle |
| `messagesCollection` | `id` | Derived from chunks |

### 3. Stream-to-Collection Sync (`src/lib/sessions/sync.ts`)

Bridges the streaming client to reactive collections:

```typescript
// Start syncing events to collections
const unsub = syncSessionToCollections(sessionId);

// Events automatically flow:
// DurableStreamsClient → transform → TanStack Collections → React UI

// Cleanup
unsub();
```

### 4. InMemoryDurableStreamsServer (`src/lib/streams/server.ts`)

Server-side stream management:

```typescript
interface DurableStreamsServer {
  createStream(id: string, schema: unknown): Promise<void>;
  publish(id: string, type: string, data: unknown): Promise<number>;  // Returns offset
  subscribe(id: string, options?: { fromOffset?: number }): AsyncIterable<Event>;
  getEvents(id: string, options?: { offset?: number; limit?: number }): Promise<Event[]>;
}
```

**Implementation details:**

- In-memory event storage (Map of streams)
- Sequential offset assignment per stream
- Subscriber notification via async iterables
- Auto-creates stream on first publish

### 5. Session Services (`src/services/session/`)

Split into focused, single-responsibility services:

**SessionCrudService**

- Create/read/update/delete sessions
- Initialize stream on session creation
- Manage session lifecycle (active → closed)

**SessionPresenceService**

- User join/leave tracking
- Cursor position updates
- Active user queries

**SessionStreamService**

- Event publishing (non-blocking)
- Async persistence to database
- Historical event retrieval
- Session summary management

### 6. Auth Middleware (`src/lib/api/auth-middleware.ts`)

Phase 1 authentication for API protection:

```typescript
// Wrap handlers with authentication
POST: withAuth(async ({ request, auth }) => {
  // auth.userId available here
  // auth.authMethod: 'session' | 'api_token' | 'dev'
});

// Validate presence ownership
if (!validateUserIdMatch(presenceUserId, auth.userId)) {
  return forbiddenResponse('Cannot send presence for another user');
}
```

**Auth methods (checked in order):**

1. Session cookie (`agentpane_session`)
2. Authorization header (`Bearer` token)
3. Development mode bypass

## Offset-Based Resumability

The system uses monotonic offsets for reliable event ordering and reconnection:

```
Stream: session_abc123
┌─────────┬─────────┬─────────┬─────────┬─────────┬─────────┐
│ offset  │    0    │    1    │    2    │    3    │    4    │
├─────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ type    │ started │  chunk  │  tool   │  chunk  │ complete│
│ channel │  agent  │ chunks  │toolCalls│ chunks  │  agent  │
│timestamp│ 1705847│ 1705848 │ 1705849 │ 1705850 │ 1705851 │
└─────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
                              ▲
                              │
                    Client reconnects with fromOffset=2
                    Server yields events 2, 3, 4
                    No duplicate events, no gaps
```

**Client tracking:**

```typescript
eventSource.onmessage = (event) => {
  const { offset } = JSON.parse(event.data);
  lastOffset = offset;  // Track for reconnection
};

// On reconnect:
const url = `/api/streams/${sessionId}/subscribe?fromOffset=${lastOffset}`;
```

## Optimistic Updates

The system supports optimistic UI updates with rollback:

```typescript
// Terminal input with confirmation/rollback
await sendTerminalInput(sessionId, input, {
  onConfirm: (offset) => console.log('Confirmed at offset', offset),
  onRollback: () => console.log('Rolled back'),
});

// Flow:
// 1. Insert event into collection (immediate UI update)
// 2. POST to /api/streams
// 3a. Success → call onConfirm
// 3b. Failure → delete from collection, call onRollback
```

**Presence updates** use fire-and-forget with 50ms throttling:

```typescript
// Throttled to prevent excessive network traffic
sendPresenceUpdate(sessionId, userId, { x: 100, y: 200 });
```

## File Locations

```
src/
├── lib/
│   ├── streams/
│   │   ├── client.ts           # DurableStreamsClient (EventSource wrapper)
│   │   ├── server.ts           # InMemoryDurableStreamsServer
│   │   └── provider.ts         # Stream provider singleton
│   ├── sessions/
│   │   ├── schema.ts           # Zod schemas for all event types
│   │   ├── collections.ts      # TanStack DB collection definitions
│   │   ├── sync.ts             # Stream-to-collection synchronization
│   │   ├── optimistic.ts       # Optimistic write utilities
│   │   ├── derived.ts          # Query utilities for collections
│   │   └── router.ts           # SessionEventRouter for event dispatch
│   └── api/
│       └── auth-middleware.ts  # Authentication middleware
├── services/
│   └── session/
│       ├── index.ts            # Facade re-exports
│       ├── types.ts            # Shared types and interfaces
│       ├── session-crud.service.ts     # CRUD operations
│       ├── session-presence.service.ts # Presence management
│       └── session-stream.service.ts   # Event streaming & persistence
├── db/schema/
│   ├── session-events.ts       # Event persistence table
│   └── session-summaries.ts    # Aggregated metrics table
├── app/
│   ├── routes/api/
│   │   ├── streams/
│   │   │   ├── index.ts        # POST /api/streams (write endpoint)
│   │   │   └── $streamId/
│   │   │       ├── index.ts    # GET stream metadata/events
│   │   │       └── subscribe.ts # SSE subscription endpoint
│   │   └── sessions/
│   │       ├── $id/
│   │       │   ├── events.ts   # GET events endpoint
│   │       │   ├── summary.ts  # GET summary endpoint
│   │       │   └── presence.ts # Presence join/leave/heartbeat
│   └── hooks/
│       └── use-session.ts      # React hook for session subscription
```

## Design Patterns

### Fire-and-Forget Persistence

Publishing returns immediately; database persistence happens asynchronously:

```typescript
// Fast path: publish to in-memory stream
const offset = await provider.publish(sessionId, type, data);

// Background: persist to database (non-blocking)
this.persistEvent(sessionId, event).catch(logError);
```

### Channel Routing

Type-safe event routing using discriminated unions:

```typescript
type SessionEvent =
  | { channel: 'chunks'; data: Chunk }
  | { channel: 'toolCalls'; data: ToolCall }
  | { channel: 'presence'; data: Presence }
  // ...

// Router dispatches to type-safe handlers
router.on('chunks', (event) => {
  // event.data is typed as Chunk
});
```

### Facade Pattern for Services

SessionService provides a unified API while delegating to focused services:

```typescript
// External API (unchanged)
sessionService.create(input);
sessionService.publish(sessionId, event);
sessionService.join(sessionId, userId);

// Internal delegation
this.crudService.create(input);
this.streamService.publish(sessionId, event);
this.presenceService.join(sessionId, userId);
```

## Production Considerations

**Current implementation (in-memory):**

- Loses stream data on server restart
- Single-process only (no clustering)
- Limited to available RAM

**For production, consider:**

- Replace InMemoryDurableStreamsServer with persistent backing (Redis Streams, Kafka)
- Implement proper clustering via message broker
- Add authentication validation against real auth service (Phase 2)
- Persistent offset tracking in database
- Load balancing with sticky sessions or pub/sub

## Future Enhancements

See `specs/architecture_futures/durable-streams-enhancements.md` for deferred improvements:

| Item | Priority | Status |
|------|----------|--------|
| Auth on POST /api/streams | High | **Done** |
| Type fragmentation consolidation | Medium | Pending |
| Zod validation in client | Medium | Pending |
| Reconnection attempt limit | Medium | Pending |
| Persistence retry queue | Low | Pending |
| Structured logging migration | Low | Pending |
