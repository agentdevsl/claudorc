/**
 * SessionPresenceService - User presence management
 *
 * Handles user presence in sessions:
 * - join() - User joins session
 * - leave() - User leaves session
 * - updatePresence() - Update user presence/cursor
 * - getActiveUsers() - Get active users in session
 */

import { createId } from '@paralleldrive/cuid2';
import { eq } from 'drizzle-orm';
import { sessions } from '../../db/schema';
import type { SessionError } from '../../lib/errors/session-errors.js';
import { SessionErrors } from '../../lib/errors/session-errors.js';
import type { Result } from '../../lib/utils/result.js';
import { err, ok } from '../../lib/utils/result.js';
import type { Database } from '../../types/database.js';
import type { SessionStreamService } from './session-stream.service.js';
import type { ActiveUser, PresenceUpdate, SessionWithPresence } from './types.js';

/**
 * SessionPresenceService handles user presence management
 */
export class SessionPresenceService {
  constructor(
    private db: Database,
    private presenceStore: Map<string, Map<string, ActiveUser>>,
    private getStreamService: () => SessionStreamService
  ) {}

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

    const presence = this.presenceStore.get(sessionId) ?? new Map();
    presence.set(userId, { userId, lastSeen: Date.now() });
    this.presenceStore.set(sessionId, presence);

    await this.getStreamService().publish(sessionId, {
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

    const presence = this.presenceStore.get(sessionId) ?? new Map();
    presence.delete(userId);
    this.presenceStore.set(sessionId, presence);

    await this.getStreamService().publish(sessionId, {
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

    const presence = this.presenceStore.get(sessionId) ?? new Map();
    const current = presence.get(userId);
    if (!current) {
      return err(SessionErrors.NOT_FOUND);
    }

    presence.set(userId, { ...current, ...presenceUpdate, lastSeen: Date.now() });
    this.presenceStore.set(sessionId, presence);

    await this.getStreamService().publish(sessionId, {
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

    const presence = Array.from(this.presenceStore.get(sessionId)?.values() ?? []);
    return ok(presence);
  }
}
