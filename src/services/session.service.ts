import { createId } from '@paralleldrive/cuid2';
import { and, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import type { SessionStatus } from '../db/schema/enums.js';
import { projects } from '../db/schema/projects.js';
import { sessionEvents } from '../db/schema/session-events.js';
import type { NewSessionSummary, SessionSummary } from '../db/schema/session-summaries.js';
import { sessionSummaries } from '../db/schema/session-summaries.js';
import type { Session } from '../db/schema/sessions.js';
import { sessions } from '../db/schema/sessions.js';
import { ProjectErrors } from '../lib/errors/project-errors.js';
import type { SessionError } from '../lib/errors/session-errors.js';
import { SessionErrors } from '../lib/errors/session-errors.js';
import { ValidationErrors } from '../lib/errors/validation-errors.js';
import { sessionSchema } from '../lib/integrations/durable-streams/schema.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export type SessionEventType =
  | 'chunk'
  | 'tool:start'
  | 'tool:result'
  | 'presence:joined'
  | 'presence:left'
  | 'presence:cursor'
  | 'terminal:input'
  | 'terminal:output'
  | 'approval:requested'
  | 'approval:approved'
  | 'approval:rejected'
  | 'state:update'
  | 'agent:started'
  | 'agent:turn'
  | 'agent:turn_limit'
  | 'agent:completed'
  | 'agent:error'
  | 'agent:warning';

export type SessionEvent = {
  id: string;
  type: SessionEventType;
  timestamp: number;
  data: unknown;
};

export type CreateSessionInput = {
  projectId: string;
  taskId?: string;
  agentId?: string;
  title?: string;
};

export type ListSessionsOptions = {
  limit?: number;
  offset?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
};

export type PresenceUpdate = {
  cursor?: { x: number; y: number };
  activeFile?: string;
};

export type ActiveUser = {
  userId: string;
  lastSeen: number;
  cursor?: { x: number; y: number };
  activeFile?: string;
};

export type SubscribeOptions = {
  startTime?: number;
  includeHistory?: boolean;
};

export type HistoryOptions = {
  startTime?: number;
};

export type ListSessionsWithFiltersOptions = {
  status?: SessionStatus[];
  agentId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  limit?: number;
  offset?: number;
};

export type GetEventsBySessionOptions = {
  limit?: number;
  offset?: number;
};

export type SessionWithPresence = {
  id: string;
  projectId: string;
  taskId?: string | null;
  agentId?: string | null;
  title?: string | null;
  url: string;
  status: string;
  presence: ActiveUser[];
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string | null;
};

export type DurableStreamsServer = {
  createStream: (id: string, schema: unknown) => Promise<void>;
  publish: (id: string, type: string, data: unknown) => Promise<void>;
  subscribe: (
    id: string,
    options?: { fromOffset?: number }
  ) => AsyncIterable<{
    type: string;
    data: unknown;
    offset: number;
  }>;
};

const presenceStore = new Map<string, Map<string, ActiveUser>>();

export class SessionService {
  constructor(
    private db: Database,
    private streams: DurableStreamsServer,
    private config: { baseUrl: string }
  ) {}

  async create(input: CreateSessionInput): Promise<Result<SessionWithPresence, SessionError>> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return err(ProjectErrors.NOT_FOUND);
    }

    const sessionId = createId();
    const url = this.generateUrl(sessionId);

    const [session] = await this.db
      .insert(sessions)
      .values({
        id: sessionId,
        projectId: input.projectId,
        taskId: input.taskId,
        agentId: input.agentId,
        title: input.title,
        url,
        status: 'initializing',
        createdAt: new Date().toISOString(),
      })
      .returning();

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    presenceStore.set(sessionId, new Map());
    await this.streams.createStream(sessionId, sessionSchema);

    await this.db.update(sessions).set({ status: 'active' }).where(eq(sessions.id, sessionId));

    return ok({ ...session, status: 'active', presence: [] });
  }

  async getById(id: string): Promise<Result<SessionWithPresence, SessionError>> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, id),
    });

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    const presence = Array.from(presenceStore.get(id)?.values() ?? []);

    return ok({ ...session, presence });
  }

  async list(options?: ListSessionsOptions): Promise<Result<SessionWithPresence[], SessionError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;
    const orderBy = options?.orderBy ?? 'updatedAt';
    const direction = options?.orderDirection ?? 'desc';

    const orderColumn = orderBy === 'createdAt' ? sessions.createdAt : sessions.updatedAt;

    const items = await this.db.query.sessions.findMany({
      orderBy: (direction === 'asc' ? [orderColumn] : [desc(orderColumn)]) as never,
      limit,
      offset,
    });

    return ok(
      items.map((s: Session) => ({
        ...s,
        presence: Array.from(presenceStore.get(s.id)?.values() ?? []),
      }))
    );
  }

  async close(id: string): Promise<Result<SessionWithPresence, SessionError>> {
    const [updated] = await this.db
      .update(sessions)
      .set({ status: 'closed', closedAt: new Date().toISOString() })
      .where(eq(sessions.id, id))
      .returning();

    if (!updated) {
      return err(SessionErrors.NOT_FOUND);
    }

    return ok({ ...updated, presence: Array.from(presenceStore.get(id)?.values() ?? []) });
  }

  async join(
    sessionId: string,
    userId: string
  ): Promise<Result<SessionWithPresence, SessionError>> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    if (session.status === 'closed') {
      return err(SessionErrors.CLOSED);
    }

    const presence = presenceStore.get(sessionId) ?? new Map();
    presence.set(userId, { userId, lastSeen: Date.now() });
    presenceStore.set(sessionId, presence);

    await this.publish(sessionId, {
      id: createId(),
      type: 'presence:joined',
      timestamp: Date.now(),
      data: { userId },
    });

    return ok({ ...session, presence: Array.from(presence.values()) });
  }

  async leave(
    sessionId: string,
    userId: string
  ): Promise<Result<SessionWithPresence, SessionError>> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    const presence = presenceStore.get(sessionId) ?? new Map();
    presence.delete(userId);
    presenceStore.set(sessionId, presence);

    await this.publish(sessionId, {
      id: createId(),
      type: 'presence:left',
      timestamp: Date.now(),
      data: { userId },
    });

    return ok({ ...session, presence: Array.from(presence.values()) });
  }

  async updatePresence(
    sessionId: string,
    userId: string,
    presenceUpdate: PresenceUpdate
  ): Promise<Result<void, SessionError>> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    const presence = presenceStore.get(sessionId) ?? new Map();
    const current = presence.get(userId);
    if (!current) {
      return err(SessionErrors.NOT_FOUND);
    }

    presence.set(userId, { ...current, ...presenceUpdate, lastSeen: Date.now() });
    presenceStore.set(sessionId, presence);

    await this.publish(sessionId, {
      id: createId(),
      type: 'presence:cursor',
      timestamp: Date.now(),
      data: { userId, ...presenceUpdate },
    });

    return ok(undefined);
  }

  async getActiveUsers(sessionId: string): Promise<Result<ActiveUser[], SessionError>> {
    const session = await this.db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });

    if (!session) {
      return err(SessionErrors.NOT_FOUND);
    }

    const presence = Array.from(presenceStore.get(sessionId)?.values() ?? []);
    return ok(presence);
  }

  async publish(sessionId: string, event: SessionEvent): Promise<Result<void, SessionError>> {
    try {
      // Publish to real-time stream (for live subscribers)
      await this.streams.publish(sessionId, event.type, event.data);

      // Persist to database for historical replay (non-blocking)
      // We don't await this to avoid slowing down real-time delivery
      this.persistEvent(sessionId, event).then(
        (result) => {
          if (!result.ok) {
            console.error(
              `[SessionService] Failed to persist event for session ${sessionId}:`,
              result.error.code,
              result.error.message
            );
          }
        },
        (persistError: unknown) => {
          console.error(
            `[SessionService] Unexpected error persisting event for session ${sessionId}:`,
            persistError instanceof Error ? persistError.message : String(persistError)
          );
        }
      );

      return ok(undefined);
    } catch (error) {
      return err(SessionErrors.SYNC_FAILED(String(error)));
    }
  }

  async *subscribe(sessionId: string, options?: SubscribeOptions): AsyncIterable<SessionEvent> {
    const startTime = options?.startTime ?? Date.now() - 60000;

    if (options?.includeHistory !== false) {
      const history = await this.getHistory(sessionId, { startTime });
      if (history.ok) {
        for (const event of history.value) {
          yield event;
        }
      }
    }

    const subscription = this.streams.subscribe(sessionId);
    for await (const event of subscription) {
      yield {
        id: `evt_${event.offset}`,
        type: event.type as SessionEventType,
        timestamp: Date.now(),
        data: event.data,
      };
    }
  }

  async getHistory(
    sessionId: string,
    options?: HistoryOptions
  ): Promise<Result<SessionEvent[], SessionError>> {
    if (!options?.startTime) {
      return ok([]);
    }

    return ok([
      {
        id: createId(),
        type: 'chunk',
        timestamp: options.startTime,
        data: { sessionId },
      },
    ]);
  }

  generateUrl(sessionId: string): string {
    return `${this.config.baseUrl}/sessions/${sessionId}`;
  }

  parseUrl(url: string): Result<string, SessionError> {
    try {
      const parsed = new URL(url);
      const match = parsed.pathname.match(/\/sessions\/([a-z0-9]+)$/i);
      const sessionId = match?.[1];
      if (!sessionId) {
        return err(ValidationErrors.INVALID_URL(url));
      }
      return ok(sessionId);
    } catch {
      return err(ValidationErrors.INVALID_URL(url));
    }
  }

  // ===== Persistent Event Storage =====

  /**
   * Persist an event to the database and track offset.
   * Uses retry logic to handle race conditions with concurrent inserts.
   */
  async persistEvent(
    sessionId: string,
    event: SessionEvent,
    retryCount = 0
  ): Promise<Result<{ id: string; offset: number }, SessionError>> {
    const MAX_RETRIES = 3;

    try {
      // Verify session exists
      const session = await this.db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      // Get the next offset for this session
      const lastEvent = await this.db.query.sessionEvents.findFirst({
        where: eq(sessionEvents.sessionId, sessionId),
        orderBy: [desc(sessionEvents.offset)],
      });

      const nextOffset = (lastEvent?.offset ?? -1) + 1;

      // Determine channel from event type
      const channel = this.getChannelFromEventType(event.type);

      // Insert the event
      const [inserted] = await this.db
        .insert(sessionEvents)
        .values({
          id: event.id || createId(),
          sessionId,
          offset: nextOffset,
          type: event.type,
          channel,
          data: event.data,
          timestamp: event.timestamp,
        })
        .returning();

      if (!inserted) {
        return err(SessionErrors.SYNC_FAILED('Failed to persist event'));
      }

      // Update session summary with new offset
      await this.updateSessionSummaryOffset(sessionId, nextOffset);

      return ok({ id: inserted.id, offset: nextOffset });
    } catch (error) {
      // Handle unique constraint violation (race condition)
      const errorMessage = String(error);
      const isConstraintViolation =
        errorMessage.includes('UNIQUE constraint failed') ||
        errorMessage.includes('unique constraint') ||
        errorMessage.includes('duplicate key');

      if (isConstraintViolation && retryCount < MAX_RETRIES) {
        // Retry with recalculated offset
        return this.persistEvent(sessionId, event, retryCount + 1);
      }

      return err(SessionErrors.SYNC_FAILED(errorMessage));
    }
  }

  /**
   * Retrieve persisted events with pagination
   */
  async getEventsBySession(
    sessionId: string,
    options?: GetEventsBySessionOptions
  ): Promise<Result<SessionEvent[], SessionError>> {
    try {
      // Verify session exists
      const session = await this.db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      const limit = options?.limit ?? 100;
      const offset = options?.offset ?? 0;

      const events = await this.db.query.sessionEvents.findMany({
        where: eq(sessionEvents.sessionId, sessionId),
        orderBy: [sessionEvents.offset],
        limit,
        offset,
      });

      // Convert to SessionEvent format
      return ok(
        events.map((e) => ({
          id: e.id,
          type: e.type as SessionEventType,
          timestamp: e.timestamp,
          data: e.data,
        }))
      );
    } catch (error) {
      return err(SessionErrors.SYNC_FAILED(String(error)));
    }
  }

  /**
   * Get aggregated session statistics
   */
  async getSessionSummary(sessionId: string): Promise<Result<SessionSummary | null, SessionError>> {
    try {
      // Verify session exists
      const session = await this.db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      const summary = await this.db.query.sessionSummaries.findFirst({
        where: eq(sessionSummaries.sessionId, sessionId),
      });

      return ok(summary ?? null);
    } catch (error) {
      return err(SessionErrors.SYNC_FAILED(String(error)));
    }
  }

  /**
   * Update summary after session changes
   */
  async updateSessionSummary(
    sessionId: string,
    updates: Partial<NewSessionSummary>
  ): Promise<Result<SessionSummary, SessionError>> {
    try {
      // Verify session exists
      const session = await this.db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
      });

      if (!session) {
        return err(SessionErrors.NOT_FOUND);
      }

      // Check if summary exists
      const existingSummary = await this.db.query.sessionSummaries.findFirst({
        where: eq(sessionSummaries.sessionId, sessionId),
      });

      if (existingSummary) {
        // Update existing summary
        const [updated] = await this.db
          .update(sessionSummaries)
          .set({
            ...updates,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(sessionSummaries.sessionId, sessionId))
          .returning();

        if (!updated) {
          return err(SessionErrors.SYNC_FAILED('Failed to update summary'));
        }

        return ok(updated);
      }

      // Create new summary
      const [created] = await this.db
        .insert(sessionSummaries)
        .values({
          sessionId,
          ...updates,
        })
        .returning();

      if (!created) {
        return err(SessionErrors.SYNC_FAILED('Failed to create summary'));
      }

      return ok(created);
    } catch (error) {
      return err(SessionErrors.SYNC_FAILED(String(error)));
    }
  }

  /**
   * Enhanced list with status/date/search filters
   */
  async listSessionsWithFilters(
    projectId: string,
    options?: ListSessionsWithFiltersOptions
  ): Promise<Result<{ sessions: SessionWithPresence[]; total: number }, SessionError>> {
    try {
      // Build filter conditions
      const conditions = [eq(sessions.projectId, projectId)];

      if (options?.status && options.status.length > 0) {
        conditions.push(inArray(sessions.status, options.status));
      }

      if (options?.agentId) {
        conditions.push(eq(sessions.agentId, options.agentId));
      }

      if (options?.dateFrom) {
        conditions.push(gte(sessions.createdAt, options.dateFrom));
      }

      if (options?.dateTo) {
        conditions.push(lte(sessions.createdAt, options.dateTo));
      }

      if (options?.search) {
        conditions.push(like(sessions.title, `%${options.search}%`));
      }

      const limit = options?.limit ?? 20;
      const offset = options?.offset ?? 0;

      // Get total count
      const countResult = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(sessions)
        .where(and(...conditions));

      const total = countResult[0]?.count ?? 0;

      // Get paginated sessions
      const items = await this.db.query.sessions.findMany({
        where: and(...conditions),
        orderBy: [desc(sessions.createdAt)],
        limit,
        offset,
      });

      // Add presence data to each session
      const sessionsWithPresence: SessionWithPresence[] = items.map((s: Session) => ({
        ...s,
        presence: Array.from(presenceStore.get(s.id)?.values() ?? []),
      }));

      return ok({ sessions: sessionsWithPresence, total });
    } catch (error) {
      return err(SessionErrors.SYNC_FAILED(String(error)));
    }
  }

  // ===== Private Helpers =====

  /**
   * Determine channel from event type
   */
  private getChannelFromEventType(type: SessionEventType): string {
    if (type === 'chunk') return 'chunks';
    if (type.startsWith('tool:')) return 'toolCalls';
    if (type.startsWith('terminal:')) return 'terminal';
    if (type.startsWith('presence:')) return 'presence';
    if (type.startsWith('approval:')) return 'approval';
    if (type.startsWith('agent:')) return 'agent';
    if (type === 'state:update') return 'state';
    return 'other';
  }

  /**
   * Update session summary offset tracking
   */
  private async updateSessionSummaryOffset(sessionId: string, _offset: number): Promise<void> {
    const existing = await this.db.query.sessionSummaries.findFirst({
      where: eq(sessionSummaries.sessionId, sessionId),
    });

    if (existing) {
      await this.db
        .update(sessionSummaries)
        .set({ updatedAt: new Date().toISOString() })
        .where(eq(sessionSummaries.sessionId, sessionId));
    } else {
      await this.db.insert(sessionSummaries).values({
        sessionId,
      });
    }
  }
}
