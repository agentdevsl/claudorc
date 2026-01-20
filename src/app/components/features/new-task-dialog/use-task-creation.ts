import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

// ============================================================================
// Types
// ============================================================================

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskMode = 'plan' | 'implement';

export interface TaskSuggestion {
  title: string;
  description: string;
  labels: string[];
  priority: TaskPriority;
  mode: TaskMode;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export type SessionStatus = 'idle' | 'connecting' | 'active' | 'completed' | 'cancelled' | 'error';

export interface UseTaskCreationState {
  /** Current session ID */
  sessionId: string | null;
  /** Current session status */
  status: SessionStatus;
  /** All messages in the conversation */
  messages: Message[];
  /** Content being streamed (not yet finalized) */
  streamingContent: string;
  /** Whether we're currently streaming a response */
  isStreaming: boolean;
  /** Current task suggestion if available */
  suggestion: TaskSuggestion | null;
  /** ID of the created task (after accept) */
  createdTaskId: string | null;
  /** Error message if any */
  error: string | null;
}

export interface UseTaskCreationActions {
  /** Start a new conversation */
  startConversation: () => Promise<void>;
  /** Send a message */
  sendMessage: (content: string) => Promise<void>;
  /** Accept the current suggestion and create a task */
  acceptSuggestion: (overrides?: Partial<TaskSuggestion>) => Promise<void>;
  /** Cancel the session */
  cancel: () => Promise<void>;
  /** Reset the state */
  reset: () => void;
}

export type UseTaskCreationReturn = UseTaskCreationState & UseTaskCreationActions;

// ============================================================================
// Hook Implementation
// ============================================================================

export function useTaskCreation(projectId: string): UseTaskCreationReturn {
  // State
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [suggestion, setSuggestion] = useState<TaskSuggestion | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Connect to SSE stream when sessionId changes
  useEffect(() => {
    if (!sessionId) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const streamUrl = apiClient.taskCreation.getStreamUrl(sessionId);
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[useTaskCreation] SSE connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'connected':
            console.log('[useTaskCreation] Stream connected for session:', data.sessionId);
            break;

          case 'task-creation:token':
            // Update streaming content with new token
            setStreamingContent(data.data.accumulated);
            setIsStreaming(true);
            break;

          case 'task-creation:message':
            // Add complete message to the list
            if (data.data.role === 'assistant') {
              setMessages((prev) => {
                // Check if message already exists
                if (prev.some((m) => m.id === data.data.messageId)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: data.data.messageId,
                    role: data.data.role,
                    content: data.data.content,
                    timestamp: new Date().toISOString(),
                  },
                ];
              });
              setStreamingContent('');
              setIsStreaming(false);
            }
            break;

          case 'task-creation:suggestion':
            // Received a task suggestion
            setSuggestion(data.data.suggestion);
            break;

          case 'task-creation:completed':
            // Task was created
            setCreatedTaskId(data.data.taskId);
            setStatus('completed');
            break;

          case 'task-creation:cancelled':
            setStatus('cancelled');
            break;

          case 'task-creation:error':
            setError(data.data.error);
            setStatus('error');
            setIsStreaming(false);
            break;

          default:
            console.log('[useTaskCreation] Unknown event type:', data.type);
        }
      } catch (err) {
        console.error('[useTaskCreation] Error parsing SSE event:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('[useTaskCreation] SSE error:', err);
      // Don't set error state for normal connection closes
      if (eventSource.readyState === EventSource.CLOSED) {
        return;
      }
      setError('Connection lost. Please try again.');
      setStatus('error');
      setIsStreaming(false);
    };

    return () => {
      eventSource.close();
    };
  }, [sessionId]);

  // Start a new conversation
  const startConversation = useCallback(async () => {
    setStatus('connecting');
    setError(null);

    const result = await apiClient.taskCreation.start(projectId);

    if (!result.ok) {
      setError(result.error.message);
      setStatus('error');
      return;
    }

    setSessionId(result.data.sessionId);
    setStatus('active');
  }, [projectId]);

  // Send a message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!sessionId) {
        setError('No active session. Please start a conversation first.');
        return;
      }

      // Add user message immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setStreamingContent('');

      // Send to API
      const result = await apiClient.taskCreation.sendMessage(sessionId, content);

      if (!result.ok) {
        setError(result.error.message);
        setIsStreaming(false);
        return;
      }

      // Update suggestion if present in response
      if (result.data.suggestion) {
        setSuggestion(result.data.suggestion);
      }
    },
    [sessionId]
  );

  // Accept suggestion and create task
  const acceptSuggestion = useCallback(
    async (overrides?: Partial<TaskSuggestion>) => {
      if (!sessionId) {
        setError('No active session.');
        return;
      }

      if (!suggestion) {
        setError('No suggestion available to accept.');
        return;
      }

      const result = await apiClient.taskCreation.accept(sessionId, overrides);

      if (!result.ok) {
        setError(result.error.message);
        return;
      }

      setCreatedTaskId(result.data.taskId);
      setStatus('completed');
    },
    [sessionId, suggestion]
  );

  // Cancel session
  const cancel = useCallback(async () => {
    if (!sessionId) return;

    const result = await apiClient.taskCreation.cancel(sessionId);

    if (!result.ok) {
      setError(result.error.message);
      return;
    }

    setStatus('cancelled');

    // Close EventSource
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, [sessionId]);

  // Reset state
  const reset = useCallback(() => {
    // Close existing connections
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset all state
    setSessionId(null);
    setStatus('idle');
    setMessages([]);
    setStreamingContent('');
    setIsStreaming(false);
    setSuggestion(null);
    setCreatedTaskId(null);
    setError(null);
  }, []);

  return {
    // State
    sessionId,
    status,
    messages,
    streamingContent,
    isStreaming,
    suggestion,
    createdTaskId,
    error,
    // Actions
    startConversation,
    sendMessage,
    acceptSuggestion,
    cancel,
    reset,
  };
}
