# SessionService Specification

## Overview

The SessionService manages collaborative agent sessions with real-time event streaming, presence tracking, and URL-addressable session access. It integrates with Durable Streams for persistent, replayable event delivery.

**Related Wireframes:**

- [Agent Session Presence](/specs/wireframes/agent-session-presence.html) - Real-time presence indicators, share URLs
- [Session History](/specs/wireframes/session-history.html) - Session replay, timeline, audit trail
- [GitHub Terminal Split](/specs/wireframes/github-terminal-split.html) - Agent stream, file preview

---

## Interface Definition

```typescript
// lib/services/session-service.ts
import type { Result } from '@/lib/utils/result';
import type { Session, NewSession } from '@/db/schema/sessions';
import type { SessionError } from '@/lib/errors/session-errors';
import type { ValidationError } from '@/lib/errors/validation-errors';

export interface SessionService {
  // ===== CRUD Operations =====

  /**
   * Create a new collaborative session
   * @param input - Session creation input
   * @returns Created session or error
   */
  create(input: CreateSessionInput): Promise<Result<Session, SessionError | ValidationError>>;

  /**
   * Get session by ID
   * @param id - Session ID (also used as URL slug)
   * @returns Session or NOT_FOUND error
   */
  getById(id: string): Promise<Result<Session, SessionError>>;

  /**
   * List sessions with filtering and pagination
   * @param options - Filter and pagination options
   * @returns Paginated session list
   */
  list(options: ListSessionsOptions): Promise<Result<PaginatedResult<Session>, SessionError>>;

  /**
   * Close a session (marks as inactive, preserves history)
   * @param id - Session ID
   * @returns Updated session or error
   */
  close(id: string): Promise<Result<Session, SessionError>>;

  // ===== Presence Management =====

  /**
   * Join a session (add user to active participants)
   * @param sessionId - Session ID
   * @param userId - User joining
   * @returns Updated session with presence or error
   */
  join(sessionId: string, userId: string): Promise<Result<SessionWithPresence, SessionError>>;

  /**
   * Leave a session (remove user from active participants)
   * @param sessionId - Session ID
   * @param userId - User leaving
   * @returns Updated session or error
   */
  leave(sessionId: string, userId: string): Promise<Result<Session, SessionError>>;

  /**
   * Update user presence (cursor position, activity)
   * @param sessionId - Session ID
   * @param userId - User ID
   * @param presence - Presence data
   * @returns void or error
   */
  updatePresence(
    sessionId: string,
    userId: string,
    presence: PresenceUpdate
  ): Promise<Result<void, SessionError>>;

  /**
   * Get all active users in a session
   * @param sessionId - Session ID
   * @returns Array of active users with presence data
   */
  getActiveUsers(sessionId: string): Promise<Result<ActiveUser[], SessionError>>;

  // ===== Event Streaming =====

  /**
   * Publish an event to the session stream
   * @param sessionId - Session ID
   * @param event - Event to publish
   * @returns void or error
   */
  publish(sessionId: string, event: SessionEvent): Promise<Result<void, SessionError>>;

  /**
   * Subscribe to session events (returns async iterator)
   * @param sessionId - Session ID
   * @param options - Subscription options (offset, filter)
   * @returns AsyncIterable of session events
   */
  subscribe(
    sessionId: string,
    options?: SubscribeOptions
  ): AsyncIterable<SessionEvent>;

  /**
   * Get historical events for a session (replay)
   * @param sessionId - Session ID
   * @param options - Time range, pagination
   * @returns Array of historical events
   */
  getHistory(
    sessionId: string,
    options?: HistoryOptions
  ): Promise<Result<SessionEvent[], SessionError>>;

  // ===== URL Generation =====

  /**
   * Generate a shareable URL for a session
   * @param sessionId - Session ID
   * @returns Full session URL
   */
  generateUrl(sessionId: string): string;

  /**
   * Parse a session URL to extract session ID
   * @param url - Session URL
   * @returns Session ID or error if invalid
   */
  parseUrl(url: string): Result<string, ValidationError>;
}
```

---

## Input/Output Types

```typescript
// lib/services/session-service.types.ts
import { z } from 'zod';

// ===== Create Session Input =====
export const createSessionInputSchema = z.object({
  projectId: z.string().cuid2(),
  taskId: z.string().cuid2().optional(),
  agentId: z.string().cuid2().optional(),
  title: z.string().max(200).optional(),
});

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>;

// ===== List Sessions Options =====
export const listSessionsOptionsSchema = z.object({
  projectId: z.string().cuid2().optional(),
  taskId: z.string().cuid2().optional(),
  agentId: z.string().cuid2().optional(),
  isActive: z.boolean().optional(),
  dateRange: z.object({
    start: z.date(),
    end: z.date(),
  }).optional(),
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
});

export type ListSessionsOptions = z.infer<typeof listSessionsOptionsSchema>;

// ===== Paginated Result =====
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount: number;
}

// ===== Presence Types =====
export const presenceUpdateSchema = z.object({
  cursor: z.object({
    x: z.number(),
    y: z.number(),
  }).optional(),
  selection: z.object({
    start: z.number(),
    end: z.number(),
  }).optional(),
  activeFile: z.string().optional(),
  lastActivity: z.number().optional(),
});

export type PresenceUpdate = z.infer<typeof presenceUpdateSchema>;

export interface ActiveUser {
  userId: string;
  joinedAt: number;
  lastSeen: number;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  activeFile?: string;
}

export interface SessionWithPresence extends Session {
  activeUsers: ActiveUser[];
  viewerCount: number;
}

// ===== Session Events (Multiplexed) =====
export const sessionEventSchema = z.discriminatedUnion('type', [
  // Agent token stream
  z.object({
    type: z.literal('chunk'),
    id: z.string(),
    agentId: z.string(),
    text: z.string(),
    timestamp: z.number(),
  }),
  // Tool call lifecycle
  z.object({
    type: z.literal('tool:start'),
    id: z.string(),
    agentId: z.string(),
    tool: z.string(),
    input: z.unknown(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('tool:result'),
    id: z.string(),
    agentId: z.string(),
    tool: z.string(),
    output: z.unknown(),
    status: z.enum(['complete', 'error']),
    duration: z.number().optional(),
    timestamp: z.number(),
  }),
  // Presence events
  z.object({
    type: z.literal('presence:joined'),
    userId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('presence:left'),
    userId: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('presence:cursor'),
    userId: z.string(),
    x: z.number(),
    y: z.number(),
    timestamp: z.number(),
  }),
  // Terminal I/O (bidirectional)
  z.object({
    type: z.literal('terminal:input'),
    id: z.string(),
    data: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('terminal:output'),
    id: z.string(),
    data: z.string(),
    timestamp: z.number(),
  }),
  // Workflow events
  z.object({
    type: z.literal('approval:requested'),
    taskId: z.string(),
    diff: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('approval:approved'),
    taskId: z.string(),
    approver: z.string(),
    timestamp: z.number(),
  }),
  z.object({
    type: z.literal('approval:rejected'),
    taskId: z.string(),
    reason: z.string(),
    timestamp: z.number(),
  }),
  // Agent state updates
  z.object({
    type: z.literal('state:update'),
    agentId: z.string(),
    status: z.enum(['idle', 'starting', 'running', 'paused', 'error', 'completed']),
    turn: z.number().optional(),
    progress: z.number().optional(),
    timestamp: z.number(),
  }),
]);

export type SessionEvent = z.infer<typeof sessionEventSchema>;

// ===== Subscribe Options =====
export interface SubscribeOptions {
  /** Start from this event offset (for resuming) */
  offset?: number;
  /** Filter by event types */
  eventTypes?: SessionEvent['type'][];
  /** Include presence events (default: true) */
  includePresence?: boolean;
}

// ===== History Options =====
export interface HistoryOptions {
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** Filter by event types */
  eventTypes?: SessionEvent['type'][];
  /** Pagination cursor */
  cursor?: string;
  /** Max events to return */
  limit?: number;
}
```

---

## Business Rules

### Session Lifecycle

```
┌──────────────┐     create()      ┌────────────┐
│   Created    │ ─────────────────>│   Active   │
└──────────────┘                   └─────┬──────┘
                                         │
                                   close() or timeout
                                         │
                                         v
                                   ┌────────────┐
                                   │   Closed   │
                                   └────────────┘
```

| Rule | Description |
|------|-------------|
| **Session Creation** | Session ID doubles as URL slug (`/sessions/{id}`) |
| **Automatic URL** | URL is generated automatically on creation |
| **Project Scope** | All sessions must belong to a project |
| **Soft Close** | Closing marks `isActive = false`, preserves history |
| **Immutable History** | Events cannot be modified after publishing |
| **Replay Support** | Closed sessions remain accessible for replay |

### Presence Management

| Rule | Description |
|------|-------------|
| **Join on Connect** | Users automatically join when subscribing to SSE |
| **Heartbeat Required** | Presence expires after 30 seconds without activity |
| **Leave on Disconnect** | Users automatically leave when SSE connection closes |
| **Cursor Throttling** | Cursor updates throttled to 50ms intervals |
| **Max Participants** | No hard limit, but UI optimizes for < 10 visible avatars |

```typescript
// Presence timeout constant
const PRESENCE_TIMEOUT_MS = 30_000; // 30 seconds

// Cursor throttle interval
const CURSOR_THROTTLE_MS = 50; // 50ms
```

### Event Publishing

| Rule | Description |
|------|-------------|
| **Agent Scoping** | Events tagged with `agentId` for multi-agent sessions |
| **Sequential IDs** | Events receive monotonically increasing IDs for ordering |
| **Timestamp Required** | All events must have a timestamp |
| **Closed Sessions** | Publishing to closed session returns `SESSION_CLOSED` error |
| **Event Size Limit** | Max event payload: 64KB |

---

## Durable Streams Integration

### Server Setup

```typescript
// lib/sessions/stream-server.ts
import { DurableStreamsServer } from '@durable-streams/server';
import { StateProtocol } from '@durable-streams/state';
import { sessionEventSchema } from './session-service.types';

const streams = new DurableStreamsServer({
  storage: 'postgres', // Backend storage
  maxEventAge: '30d',  // Retain events for 30 days
});

// Create typed stream for session events
export function createSessionStream(sessionId: string) {
  return streams.createStream(`session:${sessionId}`, {
    schema: sessionEventSchema,
    protocol: new StateProtocol(),
  });
}

// Publish event to session stream
export async function publishToSession(sessionId: string, event: SessionEvent) {
  const stream = await streams.getStream(`session:${sessionId}`);
  return stream.publish(event);
}

// Subscribe to session stream
export function subscribeToSession(
  sessionId: string,
  options?: SubscribeOptions
): AsyncIterable<SessionEvent> {
  const stream = streams.getStream(`session:${sessionId}`);
  return stream.subscribe({
    offset: options?.offset,
    filter: options?.eventTypes
      ? (event) => options.eventTypes!.includes(event.type)
      : undefined,
  });
}
```

### Client Integration

```typescript
// lib/sessions/stream-client.ts
import { DurableStreamsClient } from '@durable-streams/client';

const client = new DurableStreamsClient({
  url: '/api/streams',
  reconnectStrategy: 'exponential', // Auto-reconnect on disconnect
});

// Subscribe to session with automatic reconnection
export function createSessionSubscription(
  sessionId: string,
  callbacks: SessionCallbacks
) {
  return client.subscribe(`session:${sessionId}`, {
    onEvent: (event: SessionEvent) => {
      switch (event.type) {
        case 'chunk':
          callbacks.onChunk?.(event);
          break;
        case 'tool:start':
        case 'tool:result':
          callbacks.onToolCall?.(event);
          break;
        case 'presence:joined':
        case 'presence:left':
        case 'presence:cursor':
          callbacks.onPresence?.(event);
          break;
        case 'state:update':
          callbacks.onStateUpdate?.(event);
          break;
      }
    },
    onReconnect: (offset) => {
      // Resume from last known offset
      callbacks.onReconnect?.(offset);
    },
  });
}

interface SessionCallbacks {
  onChunk?: (event: Extract<SessionEvent, { type: 'chunk' }>) => void;
  onToolCall?: (event: Extract<SessionEvent, { type: 'tool:start' | 'tool:result' }>) => void;
  onPresence?: (event: Extract<SessionEvent, { type: `presence:${string}` }>) => void;
  onStateUpdate?: (event: Extract<SessionEvent, { type: 'state:update' }>) => void;
  onReconnect?: (offset: number) => void;
}
```

---

## Error Conditions

| Method | Error Code | Condition |
|--------|------------|-----------|
| `create` | `VALIDATION_ERROR` | Invalid input fields |
| `create` | `PROJECT_NOT_FOUND` | Referenced project doesn't exist |
| `getById` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `close` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `close` | `SESSION_CLOSED` | Session already closed |
| `join` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `join` | `SESSION_CLOSED` | Cannot join closed session |
| `leave` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `updatePresence` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `publish` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `publish` | `SESSION_CLOSED` | Cannot publish to closed session |
| `subscribe` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `subscribe` | `SESSION_CONNECTION_FAILED` | SSE/WebSocket connection failed |
| `getHistory` | `SESSION_NOT_FOUND` | Session ID doesn't exist |
| `parseUrl` | `INVALID_ID` | URL doesn't contain valid session ID |

---

## TypeScript Implementation Outline

```typescript
// lib/services/session-service.impl.ts
import { db } from '@/db/client';
import { sessions } from '@/db/schema/sessions';
import { projects } from '@/db/schema/projects';
import { eq, and, desc, gt, lt } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';
import { SessionErrors } from '@/lib/errors/session-errors';
import { ProjectErrors } from '@/lib/errors/project-errors';
import { ValidationErrors } from '@/lib/errors/validation-errors';
import { publishToSession, subscribeToSession, createSessionStream } from './stream-server';
import {
  type SessionService,
  type CreateSessionInput,
  type ListSessionsOptions,
  type PresenceUpdate,
  type SessionEvent,
  type SubscribeOptions,
  type HistoryOptions,
  createSessionInputSchema,
} from './session-service.types';

const BASE_URL = process.env.PUBLIC_URL ?? 'https://agentpane.dev';
const PRESENCE_TIMEOUT_MS = 30_000;

export function createSessionService(): SessionService {
  // In-memory presence store (would be Redis in production)
  const presenceStore = new Map<string, Map<string, ActiveUser>>();

  return {
    // ===== CRUD =====
    async create(input) {
      // Validate input
      const parsed = createSessionInputSchema.safeParse(input);
      if (!parsed.success) {
        return err(ValidationErrors.VALIDATION_ERROR(parsed.error.errors));
      }

      // Verify project exists
      const project = await db.query.projects.findFirst({
        where: eq(projects.id, parsed.data.projectId),
      });
      if (!project) {
        return err(ProjectErrors.NOT_FOUND);
      }

      // Create session
      const id = createId();
      const url = `/sessions/${id}`;

      const [session] = await db.insert(sessions).values({
        id,
        projectId: parsed.data.projectId,
        taskId: parsed.data.taskId,
        agentId: parsed.data.agentId,
        title: parsed.data.title,
        url,
        isActive: true,
      }).returning();

      // Initialize Durable Stream for this session
      await createSessionStream(id);

      return ok(session);
    },

    async getById(id) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, id),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      return ok(session);
    },

    async list(options) {
      const conditions = [];

      if (options.projectId) {
        conditions.push(eq(sessions.projectId, options.projectId));
      }
      if (options.taskId) {
        conditions.push(eq(sessions.taskId, options.taskId));
      }
      if (options.agentId) {
        conditions.push(eq(sessions.agentId, options.agentId));
      }
      if (options.isActive !== undefined) {
        conditions.push(eq(sessions.isActive, options.isActive));
      }
      if (options.dateRange) {
        conditions.push(gt(sessions.createdAt, options.dateRange.start));
        conditions.push(lt(sessions.createdAt, options.dateRange.end));
      }
      if (options.cursor) {
        conditions.push(lt(sessions.id, options.cursor));
      }

      const items = await db.query.sessions.findMany({
        where: conditions.length > 0 ? and(...conditions) : undefined,
        orderBy: [desc(sessions.createdAt)],
        limit: options.limit + 1, // Fetch one extra for hasMore
      });

      const hasMore = items.length > options.limit;
      if (hasMore) items.pop();

      return ok({
        items,
        nextCursor: hasMore ? items[items.length - 1].id : null,
        hasMore,
        totalCount: items.length, // Would need separate count query for accurate total
      });
    },

    async close(id) {
      const session = await db.query.sessions.findFirst({
        where: eq(sessions.id, id),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      if (!session.isActive) {
        return err(SessionErrors.CLOSED);
      }

      const [updated] = await db.update(sessions)
        .set({
          isActive: false,
          closedAt: new Date(),
        })
        .where(eq(sessions.id, id))
        .returning();

      // Publish session closed event
      await publishToSession(id, {
        type: 'state:update',
        agentId: session.agentId ?? 'system',
        status: 'completed',
        timestamp: Date.now(),
      });

      return ok(updated);
    },

    // ===== Presence =====
    async join(sessionId, userId) {
      const result = await this.getById(sessionId);
      if (!result.ok) return result;

      const session = result.value;
      if (!session.isActive) {
        return err(SessionErrors.CLOSED);
      }

      // Update presence store
      if (!presenceStore.has(sessionId)) {
        presenceStore.set(sessionId, new Map());
      }
      const sessionPresence = presenceStore.get(sessionId)!;

      const now = Date.now();
      sessionPresence.set(userId, {
        userId,
        joinedAt: now,
        lastSeen: now,
      });

      // Publish join event
      await publishToSession(sessionId, {
        type: 'presence:joined',
        userId,
        timestamp: now,
      });

      // Update session active users in DB
      const activeUsers = Array.from(sessionPresence.values());
      await db.update(sessions)
        .set({ activeUsers })
        .where(eq(sessions.id, sessionId));

      return ok({
        ...session,
        activeUsers,
        viewerCount: activeUsers.length,
      });
    },

    async leave(sessionId, userId) {
      const result = await this.getById(sessionId);
      if (!result.ok) return result;

      const sessionPresence = presenceStore.get(sessionId);
      if (sessionPresence) {
        sessionPresence.delete(userId);

        // Publish leave event
        await publishToSession(sessionId, {
          type: 'presence:left',
          userId,
          timestamp: Date.now(),
        });

        // Update DB
        const activeUsers = Array.from(sessionPresence.values());
        await db.update(sessions)
          .set({ activeUsers })
          .where(eq(sessions.id, sessionId));
      }

      return result;
    },

    async updatePresence(sessionId, userId, presence) {
      const sessionPresence = presenceStore.get(sessionId);
      if (!sessionPresence) {
        return err(SessionErrors.NOT_FOUND);
      }

      const user = sessionPresence.get(userId);
      if (!user) {
        return err(SessionErrors.NOT_FOUND);
      }

      // Update presence
      const now = Date.now();
      sessionPresence.set(userId, {
        ...user,
        ...presence,
        lastSeen: now,
      });

      // Publish cursor event if cursor changed
      if (presence.cursor) {
        await publishToSession(sessionId, {
          type: 'presence:cursor',
          userId,
          x: presence.cursor.x,
          y: presence.cursor.y,
          timestamp: now,
        });
      }

      return ok(undefined);
    },

    async getActiveUsers(sessionId) {
      const result = await this.getById(sessionId);
      if (!result.ok) return err(result.error);

      const sessionPresence = presenceStore.get(sessionId);
      if (!sessionPresence) {
        return ok([]);
      }

      // Filter out stale presence
      const now = Date.now();
      const activeUsers: ActiveUser[] = [];

      for (const [userId, user] of sessionPresence) {
        if (now - user.lastSeen < PRESENCE_TIMEOUT_MS) {
          activeUsers.push(user);
        } else {
          sessionPresence.delete(userId);
        }
      }

      return ok(activeUsers);
    },

    // ===== Events =====
    async publish(sessionId, event) {
      const result = await this.getById(sessionId);
      if (!result.ok) return err(result.error);

      if (!result.value.isActive) {
        return err(SessionErrors.CLOSED);
      }

      await publishToSession(sessionId, event);

      // Update event counts
      if (event.type === 'chunk') {
        await db.update(sessions)
          .set({
            messageCount: (result.value.messageCount ?? 0) + 1,
          })
          .where(eq(sessions.id, sessionId));
      } else if (event.type === 'tool:start') {
        await db.update(sessions)
          .set({
            toolCallCount: (result.value.toolCallCount ?? 0) + 1,
          })
          .where(eq(sessions.id, sessionId));
      }

      return ok(undefined);
    },

    subscribe(sessionId, options) {
      return subscribeToSession(sessionId, options);
    },

    async getHistory(sessionId, options) {
      const result = await this.getById(sessionId);
      if (!result.ok) return err(result.error);

      // Query Durable Streams for historical events
      const stream = await createSessionStream(sessionId);
      const events = await stream.getHistory({
        startTime: options?.startTime,
        endTime: options?.endTime,
        filter: options?.eventTypes
          ? (e: SessionEvent) => options.eventTypes!.includes(e.type)
          : undefined,
        cursor: options?.cursor,
        limit: options?.limit ?? 100,
      });

      return ok(events);
    },

    // ===== URL Helpers =====
    generateUrl(sessionId) {
      return `${BASE_URL}/sessions/${sessionId}`;
    },

    parseUrl(url) {
      const match = url.match(/\/sessions\/([a-z0-9]+)$/i);
      if (!match) {
        return err(ValidationErrors.INVALID_ID('sessionId'));
      }
      return ok(match[1]);
    },
  };
}

// Export singleton instance
export const sessionService = createSessionService();
```

---

## React Hooks

```typescript
// lib/hooks/use-session.ts
import { useEffect, useState, useCallback } from 'react';
import { createSessionSubscription } from '../sessions/stream-client';
import type { SessionEvent, ActiveUser, SessionWithPresence } from '../services/session-service.types';

export function useSession(sessionId: string) {
  const [session, setSession] = useState<SessionWithPresence | null>(null);
  const [events, setEvents] = useState<SessionEvent[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    async function connect() {
      try {
        // Fetch initial session data
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) throw new Error('Failed to fetch session');
        const data = await response.json();
        setSession(data);

        // Subscribe to real-time events
        unsubscribe = createSessionSubscription(sessionId, {
          onChunk: (event) => setEvents((prev) => [...prev, event]),
          onToolCall: (event) => setEvents((prev) => [...prev, event]),
          onPresence: (event) => {
            if (event.type === 'presence:joined' || event.type === 'presence:left') {
              // Refresh active users
              fetch(`/api/sessions/${sessionId}/presence`)
                .then((r) => r.json())
                .then((users) => setSession((s) => s ? { ...s, activeUsers: users } : s));
            }
          },
          onStateUpdate: (event) => setEvents((prev) => [...prev, event]),
          onReconnect: () => setIsConnected(true),
        });

        setIsConnected(true);
      } catch (e) {
        setError(e instanceof Error ? e : new Error('Unknown error'));
      }
    }

    connect();

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  return { session, events, isConnected, error };
}

export function useSessionPresence(sessionId: string) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [viewerCount, setViewerCount] = useState(0);

  useEffect(() => {
    const unsubscribe = createSessionSubscription(sessionId, {
      onPresence: (event) => {
        if (event.type === 'presence:joined') {
          setActiveUsers((prev) => [
            ...prev,
            { userId: event.userId, joinedAt: event.timestamp, lastSeen: event.timestamp },
          ]);
          setViewerCount((c) => c + 1);
        } else if (event.type === 'presence:left') {
          setActiveUsers((prev) => prev.filter((u) => u.userId !== event.userId));
          setViewerCount((c) => Math.max(0, c - 1));
        }
      },
    });

    return unsubscribe;
  }, [sessionId]);

  return { activeUsers, viewerCount };
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](/specs/database/schema.md) | `sessions` table definition |
| [Error Catalog](/specs/errors/error-catalog.md) | `SESSION_*` error codes |
| [API Endpoints](/specs/api/endpoints.md) | REST endpoints for sessions |
| [AGENTS.md](/AGENTS.md) | Durable Streams architecture |
| [User Stories](/specs/user-stories.md) | Collaborative session requirements |
