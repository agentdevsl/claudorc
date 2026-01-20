import { useCallback, useEffect, useReducer, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import type {
  PlanCompletedEventData,
  PlanErrorEventData,
  PlanInteractionEventData,
  PlanSessionAction,
  PlanSessionState,
  PlanStreamEvent,
  PlanTokenEventData,
  PlanTurnEventData,
  StreamMessage,
  UserInteraction,
} from './types';

/**
 * Generate a unique ID for messages
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Initial state for the plan session
 */
const initialState: PlanSessionState = {
  session: null,
  messages: [],
  streamingContent: '',
  isStreaming: false,
  isLoading: true,
  error: null,
  pendingInteraction: null,
  completionInfo: null,
};

/**
 * Reducer for plan session state
 */
function planSessionReducer(state: PlanSessionState, action: PlanSessionAction): PlanSessionState {
  switch (action.type) {
    case 'SET_SESSION': {
      // Convert session turns to messages
      const messages: StreamMessage[] = action.session.turns.map((turn) => ({
        id: turn.id,
        role: turn.role,
        content: turn.content,
        timestamp: new Date(turn.timestamp).getTime(),
        interaction: turn.interaction,
      }));

      return {
        ...state,
        session: action.session,
        messages,
        isLoading: false,
        error: null,
      };
    }

    case 'SET_LOADING':
      return { ...state, isLoading: action.isLoading };

    case 'SET_ERROR':
      return { ...state, error: action.error, isLoading: false };

    case 'STREAM_START':
      return { ...state, isStreaming: true, streamingContent: '' };

    case 'STREAM_TOKEN':
      return { ...state, streamingContent: action.accumulated };

    case 'STREAM_END': {
      // Create a new message from the streamed content
      const newMessage: StreamMessage = {
        id: generateId(),
        role: 'assistant',
        content: action.content,
        timestamp: Date.now(),
      };

      return {
        ...state,
        isStreaming: false,
        streamingContent: '',
        messages: [...state.messages, newMessage],
      };
    }

    case 'ADD_TURN': {
      const newMessage: StreamMessage = {
        id: action.turn.id,
        role: action.turn.role,
        content: action.turn.content,
        timestamp: new Date(action.turn.timestamp).getTime(),
        interaction: action.turn.interaction,
      };

      // Avoid duplicates by checking ID
      const exists = state.messages.some((m) => m.id === newMessage.id);
      if (exists) {
        return state;
      }

      return {
        ...state,
        messages: [...state.messages, newMessage],
      };
    }

    case 'SET_INTERACTION':
      return { ...state, pendingInteraction: action.interaction };

    case 'SET_COMPLETED':
      return {
        ...state,
        completionInfo: {
          issueUrl: action.issueUrl,
          issueNumber: action.issueNumber,
        },
        isStreaming: false,
      };

    case 'RESET':
      return initialState;

    default:
      return state;
  }
}

/**
 * Hook for managing a plan session with SSE streaming
 */
export function usePlanSession(
  taskId: string,
  projectId: string,
  options?: {
    onError?: (error: Error) => void;
  }
) {
  const [state, dispatch] = useReducer(planSessionReducer, initialState);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isInitializedRef = useRef(false);

  /**
   * Connect to the SSE stream
   */
  const connectStream = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const streamUrl = apiClient.plans.getStreamUrl(taskId);
    const eventSource = new EventSource(streamUrl);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      console.log('[PlanSession] SSE connected');
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as PlanStreamEvent;

        switch (data.type) {
          case 'connected':
            console.log('[PlanSession] Stream connected to session');
            break;

          case 'plan:token': {
            const tokenData = data.data as PlanTokenEventData;
            dispatch({
              type: 'STREAM_TOKEN',
              delta: tokenData.delta,
              accumulated: tokenData.accumulated,
            });
            break;
          }

          case 'plan:turn': {
            const turnData = data.data as PlanTurnEventData;
            dispatch({
              type: 'ADD_TURN',
              turn: {
                id: turnData.turnId,
                role: turnData.role,
                content: turnData.content,
                timestamp: new Date().toISOString(),
              },
            });
            break;
          }

          case 'plan:interaction': {
            const interactionData = data.data as PlanInteractionEventData;
            const interaction: UserInteraction = {
              id: interactionData.interactionId,
              type: 'question',
              questions: interactionData.questions,
            };
            dispatch({ type: 'SET_INTERACTION', interaction });
            break;
          }

          case 'plan:completed': {
            const completedData = data.data as PlanCompletedEventData;
            dispatch({
              type: 'SET_COMPLETED',
              issueUrl: completedData.issueUrl,
              issueNumber: completedData.issueNumber,
            });
            break;
          }

          case 'plan:error': {
            const errorData = data.data as PlanErrorEventData;
            dispatch({ type: 'SET_ERROR', error: errorData.error });
            options?.onError?.(new Error(errorData.error));
            break;
          }

          default:
            console.log('[PlanSession] Unknown event type:', data.type);
        }
      } catch (error) {
        console.error('[PlanSession] Failed to parse SSE message:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[PlanSession] SSE error:', error);
      // Reconnection is handled by EventSource automatically
    };

    return () => {
      eventSource.close();
    };
  }, [taskId, options]);

  /**
   * Load existing session or create new one
   */
  const loadSession = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', isLoading: true });

    const result = await apiClient.plans.get(taskId);

    if (!result.ok) {
      dispatch({ type: 'SET_ERROR', error: result.error.message });
      return;
    }

    if (result.data.session) {
      dispatch({ type: 'SET_SESSION', session: result.data.session });
      // Connect to stream for existing session
      connectStream();
    } else {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, [taskId, connectStream]);

  /**
   * Start a new plan session
   */
  const startSession = useCallback(
    async (initialPrompt: string) => {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      dispatch({ type: 'STREAM_START' });

      // Add user message immediately for optimistic UI
      dispatch({
        type: 'ADD_TURN',
        turn: {
          id: generateId(),
          role: 'user',
          content: initialPrompt,
          timestamp: new Date().toISOString(),
        },
      });

      const result = await apiClient.plans.start(taskId, {
        projectId,
        initialPrompt,
      });

      if (!result.ok) {
        dispatch({ type: 'SET_ERROR', error: result.error.message });
        options?.onError?.(new Error(result.error.message));
        return;
      }

      dispatch({ type: 'SET_SESSION', session: result.data.session });
      // Connect to stream for new session
      connectStream();
    },
    [taskId, projectId, connectStream, options]
  );

  /**
   * Answer an interaction
   */
  const answerInteraction = useCallback(
    async (interactionId: string, answers: Record<string, string>) => {
      dispatch({ type: 'SET_INTERACTION', interaction: null });
      dispatch({ type: 'STREAM_START' });

      // Format answers as user message
      const answerText = Object.entries(answers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\n');

      dispatch({
        type: 'ADD_TURN',
        turn: {
          id: generateId(),
          role: 'user',
          content: answerText,
          timestamp: new Date().toISOString(),
        },
      });

      const result = await apiClient.plans.answerInteraction(taskId, {
        interactionId,
        answers,
      });

      if (!result.ok) {
        dispatch({ type: 'SET_ERROR', error: result.error.message });
        options?.onError?.(new Error(result.error.message));
        return;
      }

      dispatch({ type: 'SET_SESSION', session: result.data.session });
    },
    [taskId, options]
  );

  /**
   * Cancel the session
   */
  const cancelSession = useCallback(async () => {
    const result = await apiClient.plans.cancel(taskId);

    if (!result.ok) {
      dispatch({ type: 'SET_ERROR', error: result.error.message });
      return;
    }

    dispatch({ type: 'SET_SESSION', session: result.data.session });
  }, [taskId]);

  // Initialize on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true;
      loadSession();
    }

    // Cleanup on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [loadSession]);

  return {
    state,
    startSession,
    answerInteraction,
    cancelSession,
    refresh: loadSession,
  };
}
