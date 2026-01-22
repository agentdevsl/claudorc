# Durable Streams Architecture

This document describes the architecture of the Durable Streams system used for real-time event streaming and session persistence in AgentPane.

## Overview

Durable Streams provides a unified system for:

- Real-time event streaming during active sessions
- Persistent event storage for historical replay
- Offset-based resumability for reconnection handling
- Multi-channel event categorization

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────┐    ┌─────────────────────────────────────────────┐ │
│  │   Session History UI    │    │         Active Session View                 │ │
│  │  ┌───────────────────┐  │    │  ┌─────────────────────────────────────┐   │ │
│  │  │ SessionTimeline   │  │    │  │      AgentSessionView               │   │ │
│  │  │ SessionDetailView │  │    │  │  ┌─────────────┐ ┌───────────────┐  │   │ │
│  │  │ ReplayControls    │  │    │  │  │  StreamView │ │ TerminalView  │  │   │ │
│  │  │ StreamViewer      │  │    │  │  │  ToolCalls  │ │ PresenceCursor│  │   │ │
│  │  └───────────────────┘  │    │  │  └─────────────┘ └───────────────┘  │   │ │
│  └────────────┬────────────┘    │  └──────────────────┬──────────────────┘   │ │
│               │                  │                      │                      │ │
│               │ Historical       │                      │ Real-time            │ │
│               │ Replay           │                      │ SSE Stream           │ │
│               ▼                  │                      ▼                      │ │
│  ┌─────────────────────────┐    │    ┌─────────────────────────────────────┐  │ │
│  │     React Hooks         │    │    │         EventSource                 │  │ │
│  │  ┌───────────────────┐  │    │    │  (Server-Sent Events)               │  │ │
│  │  │ useSessionDetail  │  │    │    └─────────────────────────────────────┘  │ │
│  │  │ useSessionReplay  │  │    │                                            │ │
│  │  │ useSessionEvents  │  │    │                                            │ │
│  │  └───────────────────┘  │    └────────────────────────────────────────────┘ │
│  └────────────┬────────────┘                                                    │
│               │                                                                  │
└───────────────┼──────────────────────────────────────────────────────────────────┘
                │
                │  HTTP REST / SSE
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              API LAYER                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  REST Endpoints                              SSE Endpoints                       │
│  ┌────────────────────────────────────┐     ┌────────────────────────────────┐  │
│  │ GET  /api/sessions                 │     │ GET /api/sessions/:id/stream   │  │
│  │ GET  /api/sessions/:id             │     │     (Real-time event stream)   │  │
│  │ GET  /api/sessions/:id/events      │     └────────────────────────────────┘  │
│  │ GET  /api/sessions/:id/summary     │                                         │
│  │ POST /api/sessions/:id/export      │                                         │
│  │ POST /api/sessions                 │                                         │
│  └────────────────────────────────────┘                                         │
│                                                                                  │
└───────────────┬─────────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            SERVICE LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────────┐    │
│  │                         SessionService                                   │    │
│  │  ┌───────────────────────────────────────────────────────────────────┐  │    │
│  │  │ create(input)              │ Manage session lifecycle             │  │    │
│  │  │ close(id)                  │ Join/leave presence                  │  │    │
│  │  │ join(sessionId, userId)    │ Publish events to streams            │  │    │
│  │  │ leave(sessionId, userId)   │ Subscribe to real-time events        │  │    │
│  │  │ publish(sessionId, event)  │ Persist events to database           │  │    │
│  │  │ subscribe(sessionId)       │ Retrieve historical events           │  │    │
│  │  │ persistEvent()             │ Generate session summaries           │  │    │
│  │  │ getEventsBySession()       │                                      │  │    │
│  │  │ getSessionSummary()        │                                      │  │    │
│  │  └───────────────────────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────┬────────────────────────────────────────┘    │
│                                   │                                              │
└───────────────────────────────────┼──────────────────────────────────────────────┘
                                    │
                ┌───────────────────┴───────────────────┐
                ▼                                       ▼
┌───────────────────────────────────┐   ┌───────────────────────────────────────┐
│     DURABLE STREAMS LAYER         │   │           DATABASE LAYER              │
├───────────────────────────────────┤   ├───────────────────────────────────────┤
│                                   │   │                                       │
│  ┌─────────────────────────────┐  │   │  ┌─────────────────────────────────┐ │
│  │ InMemoryDurableStreamsServer│  │   │  │         SQLite Database         │ │
│  │ ┌─────────────────────────┐ │  │   │  │  ┌───────────────────────────┐  │ │
│  │ │ createStream(id,schema) │ │  │   │  │  │     session_events        │  │ │
│  │ │ publish(id, type, data) │ │  │   │  │  │  ├─ id (PK)               │  │ │
│  │ │ subscribe(id, options)  │ │  │   │  │  │  ├─ session_id (FK)       │  │ │
│  │ │ getEvents(id, options)  │ │  │   │  │  │  ├─ offset               │  │ │
│  │ │ deleteStream(id)        │ │  │   │  │  │  ├─ type                  │  │ │
│  │ └─────────────────────────┘ │  │   │  │  │  ├─ channel              │  │ │
│  │                             │  │   │  │  │  ├─ data (JSON)          │  │ │
│  │  In-Memory Event Storage:   │  │   │  │  │  ├─ timestamp            │  │ │
│  │  ┌─────────────────────┐    │  │   │  │  │  └─ created_at           │  │ │
│  │  │ streams: Map<id,    │    │  │   │  │  └───────────────────────────┘  │ │
│  │  │   StreamMetadata>   │    │  │   │  │                                 │ │
│  │  │   ├─ events[]       │    │  │   │  │  ┌───────────────────────────┐  │ │
│  │  │   ├─ subscribers    │    │  │   │  │  │    session_summaries      │  │ │
│  │  │   └─ schema         │    │  │   │  │  │  ├─ id (PK)               │  │ │
│  │  └─────────────────────┘    │  │   │  │  │  ├─ session_id (FK,UQ)    │  │ │
│  └─────────────────────────────┘  │   │  │  │  ├─ duration_ms           │  │ │
│                                   │   │  │  │  ├─ turns_count           │  │ │
└───────────────────────────────────┘   │  │  │  ├─ tokens_used           │  │ │
                                        │  │  │  ├─ files_modified        │  │ │
                                        │  │  │  ├─ lines_added           │  │ │
                                        │  │  │  ├─ lines_removed         │  │ │
                                        │  │  │  └─ final_status          │  │ │
                                        │  │  └───────────────────────────┘  │ │
                                        │  └─────────────────────────────────┘ │
                                        └───────────────────────────────────────┘
```

## Event Channels

The system supports six distinct event channels, each with its own schema:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           SESSION EVENT SCHEMA                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐             │
│  │  chunks    │  │ toolCalls  │  │  presence  │  │  terminal  │             │
│  │            │  │            │  │            │  │            │             │
│  │ • id       │  │ • id       │  │ • userId   │  │ • id       │             │
│  │ • agentId  │  │ • agentId  │  │ • sessionId│  │ • sessionId│             │
│  │ • sessionId│  │ • sessionId│  │ • cursor   │  │ • type     │             │
│  │ • text     │  │ • tool     │  │ • lastSeen │  │ • data     │             │
│  │ • turn     │  │ • input    │  │ • joinedAt │  │ • source   │             │
│  │ • timestamp│  │ • output   │  │            │  │ • timestamp│             │
│  │            │  │ • status   │  │            │  │            │             │
│  │            │  │ • duration │  │            │  │            │             │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘             │
│                                                                              │
│  ┌────────────┐  ┌────────────┐                                             │
│  │  workflow  │  │ agentState │                                             │
│  │            │  │            │                                             │
│  │ • id       │  │ • agentId  │                                             │
│  │ • sessionId│  │ • sessionId│                                             │
│  │ • taskId   │  │ • status   │                                             │
│  │ • type     │  │ • taskId   │                                             │
│  │ • payload  │  │ • turn     │                                             │
│  │ • actor    │  │ • progress │                                             │
│  │ • timestamp│  │ • message  │                                             │
│  │            │  │ • error    │                                             │
│  └────────────┘  └────────────┘                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Real-time Streaming (Active Sessions)

```
┌─────────┐    ┌─────────────┐    ┌───────────────┐    ┌────────────────┐
│  Agent  │───►│   Session   │───►│    Durable    │───►│   Subscriber   │
│  SDK    │    │   Service   │    │    Streams    │    │   (SSE/WS)     │
└─────────┘    └─────────────┘    └───────────────┘    └────────────────┘
     │               │                    │                    │
     │  emit event   │  publish()         │  notify            │  yield event
     │──────────────►│───────────────────►│───────────────────►│
     │               │                    │                    │
     │               │  persistEvent()    │                    │
     │               │──────────┐         │                    │
     │               │          ▼         │                    │
     │               │    ┌──────────┐    │                    │
     │               │    │ SQLite   │    │                    │
     │               │    │ Events   │    │                    │
     │               │    └──────────┘    │                    │
     │               │                    │                    │
```

### Historical Replay (Closed Sessions)

```
┌────────────┐    ┌───────────────┐    ┌─────────────────┐    ┌────────────────┐
│  History   │───►│  API Endpoint │───►│  SessionService │───►│     SQLite     │
│    UI      │    │  /events      │    │ getEventsBySession│   │    Database    │
└────────────┘    └───────────────┘    └─────────────────┘    └────────────────┘
     │                   │                      │                     │
     │  fetch events     │  GET request         │  query              │  return rows
     │──────────────────►│─────────────────────►│────────────────────►│
     │                   │                      │                     │
     │  paginated events │◄─────────────────────│◄────────────────────│
     │◄──────────────────│                      │                     │
     │                   │                      │                     │
     │  replay with      │                      │                     │
     │  useSessionReplay │                      │                     │
     │                   │                      │                     │
```

## Key Components

### 1. InMemoryDurableStreamsServer

The core server implementation providing:

- Stream lifecycle management (create, delete)
- Event publishing with automatic offset assignment
- Subscription with offset-based resumability
- In-memory event buffer for real-time delivery

```typescript
interface DurableStreamsServer {
  createStream(id: string, schema: unknown): Promise<void>;
  publish(id: string, type: string, data: unknown): Promise<void>;
  subscribe(id: string, options?: { fromOffset?: number }): AsyncIterable<Event>;
}
```

### 2. SessionService

Integrates durable streams with session management:

- Creates sessions with associated streams
- Publishes events to both stream and database
- Manages presence tracking
- Provides historical event retrieval

### 3. Session Event Tables

**session_events**

- Stores all events with offset-based ordering
- Indexed by session_id and offset for efficient queries
- JSON data column for flexible event payloads

**session_summaries**

- Aggregated metrics per session
- Updated incrementally as events occur
- Used for quick session list rendering

### 4. UI Components

**SessionHistoryPage**

- Timeline view of all sessions
- Filter by status, date, agent, search
- Export functionality (JSON, Markdown, CSV)

**ReplayControls**

- Play/pause with smooth animation
- Seek with draggable progress bar
- Speed controls (1x, 2x, 4x)
- Keyboard shortcuts

**StreamViewer**

- Chronological event list
- Auto-scroll during playback
- Current position highlighting
- Expandable tool call details

## Offset-Based Resumability

The system uses monotonic offsets for reliable event ordering:

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
    Only receives events 2, 3, 4
```

## File Locations

```
src/
├── lib/
│   ├── streams/
│   │   ├── server.ts          # InMemoryDurableStreamsServer
│   │   └── provider.ts        # Stream provider singleton
│   └── integrations/
│       └── durable-streams/
│           └── schema.ts      # Event channel schemas
├── services/
│   └── session.service.ts     # Session management with streams
├── db/schema/
│   ├── session-events.ts      # Event persistence table
│   └── session-summaries.ts   # Aggregated metrics table
├── app/
│   ├── routes/api/sessions/
│   │   ├── $id/events.ts      # GET events endpoint
│   │   ├── $id/summary.ts     # GET summary endpoint
│   │   └── $id/export.ts      # POST export endpoint
│   └── components/features/session-history/
│       ├── index.tsx          # SessionHistoryPage
│       ├── components/
│       │   ├── replay-controls.tsx
│       │   ├── stream-viewer.tsx
│       │   └── session-timeline.tsx
│       └── hooks/
│           ├── use-session-replay.ts
│           └── use-session-events.ts
```
