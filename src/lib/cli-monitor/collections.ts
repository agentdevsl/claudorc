/**
 * TanStack DB Collection for CLI Monitor Sessions
 *
 * Local-only collection that tracks active CLI sessions.
 * Synced via SSE from the API.
 */

import { createCollection, localOnlyCollectionOptions } from '@tanstack/db';
import { type CliSession, cliSessionSchema } from './schema.js';

// Re-export the type for convenience
export type { CliSession };

/**
 * CLI sessions collection
 *
 * Primary key: sessionId
 * Tracks all active CLI sessions reported by the daemon
 */
export const cliSessionsCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'cli-monitor-sessions',
    schema: cliSessionSchema,
    getKey: (session) => session.sessionId,
  })
);

/**
 * Upsert a CLI session (insert or update)
 */
export function upsertCliSession(session: CliSession): void {
  if (cliSessionsCollection.has(session.sessionId)) {
    cliSessionsCollection.update(session.sessionId, (draft) => {
      draft.status = session.status;
      draft.messageCount = session.messageCount;
      draft.turnCount = session.turnCount;
      draft.goal = session.goal;
      draft.recentOutput = session.recentOutput;
      draft.pendingToolUse = session.pendingToolUse;
      draft.tokenUsage = session.tokenUsage;
      draft.model = session.model;
      draft.lastActivityAt = session.lastActivityAt;
      draft.lastReadOffset = session.lastReadOffset;
      draft.gitBranch = session.gitBranch;
      draft.isSubagent = session.isSubagent;
      draft.parentSessionId = session.parentSessionId;
      draft.performanceMetrics = session.performanceMetrics;
    });
  } else {
    cliSessionsCollection.insert(session);
  }
}

/**
 * Remove a CLI session by ID
 */
export function removeCliSession(sessionId: string): void {
  if (cliSessionsCollection.has(sessionId)) {
    cliSessionsCollection.delete(sessionId);
  }
}

/**
 * Bulk sync sessions from a snapshot.
 * Upserts all incoming sessions and removes any in the collection not present in the incoming set.
 */
export function bulkSyncSessions(sessions: CliSession[]): void {
  const incomingIds = new Set(sessions.map((s) => s.sessionId));

  // Remove sessions no longer in the snapshot
  const existingIds: string[] = [];
  for (const [key] of cliSessionsCollection) {
    existingIds.push(key);
  }
  for (const id of existingIds) {
    if (!incomingIds.has(id)) {
      cliSessionsCollection.delete(id);
    }
  }

  // Upsert all incoming sessions
  for (const session of sessions) {
    upsertCliSession(session);
  }
}

/**
 * Clear all CLI sessions from the collection
 */
export function clearAllCliSessions(): void {
  const ids: string[] = [];
  for (const [key] of cliSessionsCollection) {
    ids.push(key);
  }
  for (const id of ids) {
    cliSessionsCollection.delete(id);
  }
}
