import { createCollection, localOnlyCollectionOptions } from '@tanstack/db';
import {
  type TaskCreationMessage,
  type TaskCreationSession,
  taskCreationMessageSchema,
  taskCreationSessionSchema,
} from './schema';

// ============================================================================
// Task Creation Collections
// ============================================================================

/**
 * Collection for task creation sessions
 * Stores the current state of each task creation session
 */
export const taskCreationSessionsCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'task-creation-sessions',
    schema: taskCreationSessionSchema,
    getKey: (session: TaskCreationSession) => session.id,
  })
);

/**
 * Collection for task creation messages
 * Stores all messages in task creation conversations
 */
export const taskCreationMessagesCollection = createCollection(
  localOnlyCollectionOptions({
    id: 'task-creation-messages',
    schema: taskCreationMessageSchema,
    getKey: (message: TaskCreationMessage) => message.id,
  })
);

/**
 * Export all task creation collections
 */
export const taskCreationCollections = {
  sessions: taskCreationSessionsCollection,
  messages: taskCreationMessagesCollection,
} as const;

/**
 * Get collection statistics for debugging
 */
export function getTaskCreationCollectionStats(): {
  sessions: { size: number; ready: boolean };
  messages: { size: number; ready: boolean };
} {
  return {
    sessions: {
      size: taskCreationSessionsCollection.size,
      ready: taskCreationSessionsCollection.isReady(),
    },
    messages: {
      size: taskCreationMessagesCollection.size,
      ready: taskCreationMessagesCollection.isReady(),
    },
  };
}

/**
 * Clear all task creation data for a session
 */
export function clearTaskCreationSession(sessionId: string): void {
  // Delete session
  if (taskCreationSessionsCollection.has(sessionId)) {
    taskCreationSessionsCollection.delete(sessionId);
  }

  // Delete all messages for this session
  for (const message of taskCreationMessagesCollection.toArray) {
    if (message.sessionId === sessionId) {
      taskCreationMessagesCollection.delete(message.id);
    }
  }
}

/**
 * Clear all task creation data
 */
export function clearAllTaskCreationData(): void {
  // Clear all sessions
  for (const session of taskCreationSessionsCollection.toArray) {
    taskCreationSessionsCollection.delete(session.id);
  }

  // Clear all messages
  for (const message of taskCreationMessagesCollection.toArray) {
    taskCreationMessagesCollection.delete(message.id);
  }
}
