import { createId } from '@paralleldrive/cuid2';
import { desc, eq } from 'drizzle-orm';
import { err, ok } from '../lib/utils/result.js';
import type { Result } from '../lib/utils/result.js';
import { SessionErrors } from '../lib/errors/session-errors.js';
import { ProjectErrors } from '../lib/errors/project-errors.js';
import { ValidationErrors } from '../lib/errors/validation-errors.js';
import type { SessionError } from '../lib/errors/session-errors.js';
import type { Database } from '../types/database.js';
import { sessions } from '../db/schema/sessions.js';
import { projects } from '../db/schema/projects.js';
import { sessionSchema } from '../lib/integrations/durable-streams/schema.js';

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
  | 'state:update';

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

export type SessionWithPresence = {
  id: string;
  projectId: string;
  taskId?: string | null;
  agentId?: string | null;
  title?: string | null;
  url: string;
  status: string;
  presence: ActiveUser[];
};

export type DurableStreamsServer = {
  createStream: (id: string, schema: unknown) => Promise<void>;
  publish: (id: string, type: string, data: unknown) => Promise<void>;
  subscribe: (id: string) => AsyncIterable<{ type: string; data: unknown }>;
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
        createdAt: new Date(),
      })
      .returning();

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
      items.map((session) => ({
        ...session,
        presence: Array.from(presenceStore.get(session.id)?.values() ?? []),
      }))
    );
  }

  async close(id: string): Promise<Result<SessionWithPresence, SessionError>> {
    const [updated] = await this.db
      .update(sessions)
      .set({ status: 'closed', closedAt: new Date() })
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
      await this.streams.publish(sessionId, event.type, event.data);
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
        id: createId(),
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
      if (!match) {
        return err(ValidationErrors.INVALID_URL(url));
      }
      return ok(match[1]);
    } catch {
      return err(ValidationErrors.INVALID_URL(url));
    }
  }
}
