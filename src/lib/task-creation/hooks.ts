import { eq } from '@tanstack/db';
import { useLiveQuery } from '@tanstack/react-db';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { taskCreationMessagesCollection, taskCreationSessionsCollection } from './collections';
import type {
  PendingQuestions,
  SessionStatus,
  TaskCreationMessage,
  TaskCreationSession,
  TaskSuggestion,
} from './schema';
import {
  addUserMessage,
  createTaskCreationSession,
  resetTaskCreationSession,
  stopTaskCreationSync,
  syncTaskCreationToCollections,
} from './sync';

// ============================================================================
// Types
// ============================================================================

export interface UseTaskCreationState {
  /** Current session ID */
  sessionId: string | null;
  /** Current session status */
  status: SessionStatus;
  /** All messages in the conversation */
  messages: TaskCreationMessage[];
  /** Content being streamed (not yet finalized) */
  streamingContent: string;
  /** Whether we're currently streaming a response */
  isStreaming: boolean;
  /** Current task suggestion if available */
  suggestion: TaskSuggestion | null;
  /** Pending clarifying questions */
  pendingQuestions: PendingQuestions | null;
  /** ID of the created task (after accept) */
  createdTaskId: string | null;
  /** Error message if any (from session or local operations) */
  error: string | null;
  /** Local error from hook operations (separate from session errors) */
  localError: string | null;
}

export interface UseTaskCreationActions {
  /** Start a new conversation */
  startConversation: () => Promise<void>;
  /** Send a message */
  sendMessage: (content: string) => Promise<void>;
  /** Accept the current suggestion and create a task */
  acceptSuggestion: (
    overrides?: Partial<TaskSuggestion>
  ) => Promise<{ ok: boolean; error?: string }>;
  /** Answer clarifying questions */
  answerQuestions: (answers: Record<string, string>) => Promise<void>;
  /** Skip clarifying questions */
  skipQuestions: () => Promise<void>;
  /** Cancel the session */
  cancel: () => Promise<void>;
  /** Reset the state */
  reset: () => void;
  /** Clear any local error */
  clearLocalError: () => void;
}

export type UseTaskCreationReturn = UseTaskCreationState & UseTaskCreationActions;

// ============================================================================
// Hooks
// ============================================================================

/**
 * Get a task creation session by ID using live query
 */
export function useTaskCreationSession(sessionId: string | null): TaskCreationSession | null {
  // Use empty string when no sessionId to create a valid query that returns nothing
  const queryId = sessionId ?? '';

  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ sessions: taskCreationSessionsCollection })
        .where(({ sessions }) => eq(sessions.id, queryId)),
    [queryId]
  );

  return data?.[0] ?? null;
}

/**
 * Get all messages for a task creation session using live query
 */
export function useTaskCreationMessages(sessionId: string | null): TaskCreationMessage[] {
  // Use empty string when no sessionId to create a valid query that returns nothing
  const queryId = sessionId ?? '';

  const { data } = useLiveQuery(
    (q) =>
      q
        .from({ messages: taskCreationMessagesCollection })
        .where(({ messages }) => eq(messages.sessionId, queryId)),
    [queryId]
  );

  // Sort by timestamp
  return useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.timestamp - b.timestamp);
  }, [data]);
}

/**
 * Main hook for task creation functionality
 * Manages session lifecycle, API calls, and TanStack DB synchronization
 */
export function useTaskCreation(projectId: string): UseTaskCreationReturn {
  // Local state for session ID (only thing we need to track locally)
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Local error state for operation failures (separate from session errors)
  const [localError, setLocalError] = useState<string | null>(null);

  // Get session and messages from TanStack DB (reactive)
  const session = useTaskCreationSession(sessionId);
  const messages = useTaskCreationMessages(sessionId);

  // Derive state from session
  const status: SessionStatus = session?.status ?? 'idle';
  const streamingContent = session?.streamingContent ?? '';
  const isStreaming = session?.isStreaming ?? false;
  const suggestion = session?.suggestion ?? null;
  const pendingQuestions = session?.pendingQuestions ?? null;
  const createdTaskId = session?.createdTaskId ?? null;
  const error = session?.error ?? null;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        stopTaskCreationSync(sessionId);
      }
    };
  }, [sessionId]);

  // Start a new conversation
  const startConversation = useCallback(async () => {
    // Clear any previous local error
    setLocalError(null);

    // Call API to start session
    const result = await apiClient.taskCreation.start(projectId);

    if (!result.ok) {
      console.error('[useTaskCreation] Failed to start conversation:', result.error);
      setLocalError(result.error.message || 'Failed to start conversation');
      return;
    }

    const newSessionId = result.data.sessionId;

    // Create session in TanStack DB collection
    createTaskCreationSession(newSessionId, projectId);

    // Start syncing SSE events to collection
    const streamUrl = apiClient.taskCreation.getStreamUrl(newSessionId);
    syncTaskCreationToCollections(newSessionId, streamUrl);

    // Update local state
    setSessionId(newSessionId);
  }, [projectId]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) {
        console.error('[useTaskCreation] No active session');
        setLocalError('No active session');
        return;
      }

      // Clear any previous local error
      setLocalError(null);

      // Add user message to collection immediately (optimistic)
      addUserMessage(sessionId, content);

      // Send to API
      const result = await apiClient.taskCreation.sendMessage(sessionId, content);

      if (!result.ok) {
        console.error('[useTaskCreation] Failed to send message:', result.error);
        // Set local error - SSE may also send an error event but this ensures immediate feedback
        setLocalError(result.error.message || 'Failed to send message');
      }
    },
    [sessionId]
  );

  // Accept suggestion and create task
  const acceptSuggestion = useCallback(
    async (overrides?: Partial<TaskSuggestion>): Promise<{ ok: boolean; error?: string }> => {
      if (!sessionId) {
        console.error('[useTaskCreation] No active session');
        return { ok: false, error: 'No active session' };
      }

      // When overrides contain all required fields (title, description), we don't need
      // the TanStack DB suggestion - the API can create the task from overrides alone
      const hasCompleteOverrides = overrides?.title && overrides?.description;
      if (!suggestion && !hasCompleteOverrides) {
        console.error('[useTaskCreation] No suggestion available and overrides incomplete');
        return { ok: false, error: 'No suggestion available' };
      }

      console.log('[useTaskCreation] Accepting suggestion:', { sessionId, overrides, suggestion });
      const result = await apiClient.taskCreation.accept(sessionId, overrides);

      if (!result.ok) {
        console.error('[useTaskCreation] Failed to accept suggestion:', result.error);
        return { ok: false, error: result.error.message };
      }

      console.log('[useTaskCreation] Accept API succeeded:', result.data);
      // Completion will be handled via SSE event
      return { ok: true };
    },
    [sessionId, suggestion]
  );

  // Answer clarifying questions
  const answerQuestions = useCallback(
    async (answers: Record<string, string>) => {
      if (!sessionId || !pendingQuestions) {
        console.error('[useTaskCreation] No active session or pending questions');
        setLocalError('No active session or pending questions');
        return;
      }

      // Clear any previous local error
      setLocalError(null);

      const result = await apiClient.taskCreation.answerQuestions(
        sessionId,
        pendingQuestions.id,
        answers
      );

      if (!result.ok) {
        console.error('[useTaskCreation] Failed to answer questions:', result.error);
        // Set local error - SSE may also send an error event but this ensures immediate feedback
        setLocalError(result.error.message || 'Failed to submit answers');
      }
    },
    [sessionId, pendingQuestions]
  );

  // Skip clarifying questions
  const skipQuestions = useCallback(async () => {
    if (!sessionId) {
      console.error('[useTaskCreation] No active session');
      setLocalError('No active session');
      return;
    }

    // Clear any previous local error
    setLocalError(null);

    const result = await apiClient.taskCreation.skipQuestions(sessionId);

    if (!result.ok) {
      console.error('[useTaskCreation] Failed to skip questions:', result.error);
      // Set local error - SSE may also send an error event but this ensures immediate feedback
      setLocalError(result.error.message || 'Failed to skip questions');
    }
  }, [sessionId]);

  // Cancel session
  const cancel = useCallback(async () => {
    if (!sessionId) {
      console.error('[useTaskCreation] No active session to cancel');
      return;
    }

    // Clear any previous local error
    setLocalError(null);

    const result = await apiClient.taskCreation.cancel(sessionId);

    if (!result.ok) {
      console.error('[useTaskCreation] Failed to cancel:', result.error);
      // Set local error - SSE may also send an error event but this ensures immediate feedback
      setLocalError(result.error.message || 'Failed to cancel session');
    }
  }, [sessionId]);

  // Reset state
  const reset = useCallback(() => {
    if (sessionId) {
      resetTaskCreationSession(sessionId);
    }
    setSessionId(null);
    setLocalError(null);
  }, [sessionId]);

  // Clear local error
  const clearLocalError = useCallback(() => {
    setLocalError(null);
  }, []);

  return {
    // State (from TanStack DB)
    sessionId,
    status,
    messages,
    streamingContent,
    isStreaming,
    suggestion,
    pendingQuestions,
    createdTaskId,
    error,
    localError,
    // Actions
    startConversation,
    sendMessage,
    acceptSuggestion,
    answerQuestions,
    skipQuestions,
    cancel,
    reset,
    clearLocalError,
  };
}
