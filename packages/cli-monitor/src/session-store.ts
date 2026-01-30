export type SessionStatus = 'working' | 'waiting_for_approval' | 'waiting_for_input' | 'idle';

export interface StoredSession {
  sessionId: string;
  filePath: string;
  cwd: string;
  projectName: string;
  projectHash: string;
  gitBranch?: string;
  status: SessionStatus;
  messageCount: number;
  turnCount: number;
  goal?: string;
  recentOutput?: string;
  pendingToolUse?: { toolName: string; toolId: string };
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  };
  model?: string;
  startedAt: number;
  lastActivityAt: number;
  lastReadOffset: number;
  isSubagent: boolean;
  parentSessionId?: string;
}

const MAX_SESSIONS = 1000;
const MAX_PENDING_CHANGES = 5000;

export class SessionStore {
  private sessions = new Map<string, StoredSession>();
  private readOffsets = new Map<string, number>(); // filePath -> byte offset
  private changedSessionIds = new Set<string>();
  private removedSessionIds = new Set<string>();

  getSession(id: string): StoredSession | undefined {
    return this.sessions.get(id);
  }

  setSession(id: string, session: StoredSession): void {
    this.sessions.set(id, session);
    this.changedSessionIds.add(id);
    this.removedSessionIds.delete(id);

    // Evict oldest session if over limit (only when adding new sessions)
    if (this.sessions.size > MAX_SESSIONS) {
      this.evictOldest();
    }
  }

  private evictOldest(): void {
    let oldestId: string | null = null;
    let oldestTime = Infinity;
    for (const [id, s] of this.sessions) {
      if (s.lastActivityAt < oldestTime) {
        oldestTime = s.lastActivityAt;
        oldestId = id;
      }
    }
    if (oldestId) {
      const session = this.sessions.get(oldestId);
      if (session) this.readOffsets.delete(session.filePath);
      this.removeSession(oldestId);
    }
  }

  removeSession(id: string): void {
    this.sessions.delete(id);
    this.changedSessionIds.delete(id);
    this.removedSessionIds.add(id);
  }

  removeByFilePath(filePath: string): void {
    for (const [id, session] of this.sessions) {
      if (session.filePath === filePath) {
        this.removeSession(id);
      }
    }
    this.readOffsets.delete(filePath);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  getReadOffset(filePath: string): number {
    return this.readOffsets.get(filePath) || 0;
  }

  setReadOffset(filePath: string, offset: number): void {
    this.readOffsets.set(filePath, offset);
  }

  /** Flush pending changes for batched ingest. Returns changed sessions + removed IDs. */
  flushChanges(): { updated: StoredSession[]; removed: string[] } {
    const updated: StoredSession[] = [];
    for (const id of this.changedSessionIds) {
      const session = this.sessions.get(id);
      if (session) updated.push({ ...session });
    }
    const removed = Array.from(this.removedSessionIds);

    this.changedSessionIds.clear();
    this.removedSessionIds.clear();

    return { updated, removed };
  }

  /** Re-add changes that failed to send (for retry on next cycle).
   *  Capped at MAX_PENDING_CHANGES to prevent memory exhaustion when server is down. */
  markPendingRetry(sessions: StoredSession[], removedIds: string[]): void {
    for (const s of sessions) {
      if (this.changedSessionIds.size >= MAX_PENDING_CHANGES) break;
      this.changedSessionIds.add(s.sessionId);
    }
    for (const id of removedIds) {
      if (this.removedSessionIds.size >= MAX_PENDING_CHANGES) break;
      this.removedSessionIds.add(id);
    }
  }

  /** Evict sessions that have been idle longer than maxIdleMs. Returns eviction count. */
  evictIdleSessions(maxIdleMs: number): number {
    const cutoff = Date.now() - maxIdleMs;
    let evicted = 0;
    for (const [id, session] of this.sessions) {
      if (session.status === 'idle' && session.lastActivityAt < cutoff) {
        this.removeSession(id);
        this.readOffsets.delete(session.filePath);
        evicted++;
      }
    }
    return evicted;
  }

  markIdleSessions(timeoutMs: number): void {
    const cutoff = Date.now() - timeoutMs;
    for (const [id, session] of this.sessions) {
      if (session.status !== 'idle' && session.lastActivityAt < cutoff) {
        session.status = 'idle';
        this.changedSessionIds.add(id);
      }
    }
  }
}
