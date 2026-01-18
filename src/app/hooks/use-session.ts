import { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionErrors } from '@/lib/errors/session-errors';
import { err, ok, type Result } from '@/lib/utils/result';

export type SessionEvent = {
  type: string;
  data: unknown;
  timestamp: number;
};

export type SessionChunk = {
  text: string;
  timestamp: number;
  agentId?: string;
};

export type SessionToolCall = {
  id: string;
  tool: string;
  input: unknown;
  output?: unknown;
  status: 'pending' | 'running' | 'complete' | 'error';
  timestamp: number;
};

export type SessionTerminal = {
  type: 'input' | 'output';
  data: string;
  timestamp: number;
};

export type SessionPresence = {
  userId: string;
  lastSeen: number;
  cursor?: { x: number; y: number };
};

export type SessionAgentState = {
  status: string;
  turn?: number;
  progress?: number;
} | null;

export type SessionState = {
  chunks: SessionChunk[];
  toolCalls: SessionToolCall[];
  terminal: SessionTerminal[];
  presence: SessionPresence[];
  agentState: SessionAgentState;
};

const initialState: SessionState = {
  chunks: [],
  toolCalls: [],
  terminal: [],
  presence: [],
  agentState: null,
};

const mapEvent = (prev: SessionState, event: SessionEvent): SessionState => {
  switch (event.type) {
    case 'chunk':
      return {
        ...prev,
        chunks: [
          ...prev.chunks,
          {
            text: (event.data as { text?: string }).text ?? '',
            timestamp: event.timestamp,
            agentId: (event.data as { agentId?: string }).agentId,
          },
        ],
      };
    case 'tool:start':
      return {
        ...prev,
        toolCalls: [
          ...prev.toolCalls,
          {
            id: (event.data as { id?: string }).id ?? crypto.randomUUID(),
            tool: (event.data as { tool?: string }).tool ?? 'tool',
            input: (event.data as { input?: unknown }).input,
            status: 'running',
            timestamp: event.timestamp,
          },
        ],
      };
    case 'tool:result':
      return {
        ...prev,
        toolCalls: prev.toolCalls.map((call) =>
          call.id === (event.data as { id?: string }).id
            ? {
                ...call,
                output: (event.data as { output?: unknown }).output,
                status: 'complete',
              }
            : call
        ),
      };
    case 'presence:joined':
    case 'presence:left':
    case 'presence:cursor':
      return prev;
    case 'terminal:input':
    case 'terminal:output':
      return {
        ...prev,
        terminal: [
          ...prev.terminal,
          {
            type: event.type === 'terminal:input' ? 'input' : 'output',
            data: (event.data as { data?: string }).data ?? '',
            timestamp: event.timestamp,
          },
        ],
      };
    case 'state:update':
      return {
        ...prev,
        agentState: event.data as SessionAgentState,
      };
    default:
      return prev;
  }
};

export function useSession(
  sessionId: string,
  userId: string
): {
  state: SessionState;
  join: () => Promise<Result<void, ReturnType<typeof SessionErrors.CONNECTION_FAILED>>>;
  leave: () => Promise<Result<void, ReturnType<typeof SessionErrors.CONNECTION_FAILED>>>;
} {
  const [state, setState] = useState<SessionState>(initialState);

  const join = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'join' }),
      });
      const data = await response.json();
      if (!data.ok) {
        return err(SessionErrors.CONNECTION_FAILED(data.error?.message ?? 'Join failed'));
      }
      return ok(undefined);
    } catch (error) {
      return err(
        SessionErrors.CONNECTION_FAILED(error instanceof Error ? error.message : 'Join failed')
      );
    }
  }, [sessionId, userId]);

  const leave = useCallback(async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/presence`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'leave' }),
      });
      const data = await response.json();
      if (!data.ok) {
        return err(SessionErrors.CONNECTION_FAILED(data.error?.message ?? 'Leave failed'));
      }
      return ok(undefined);
    } catch (error) {
      return err(
        SessionErrors.CONNECTION_FAILED(error instanceof Error ? error.message : 'Leave failed')
      );
    }
  }, [sessionId, userId]);

  useEffect(() => {
    void join();

    const eventSource = new EventSource(`/api/sessions/${sessionId}/stream`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data) as SessionEvent;
      setState((prev) => mapEvent(prev, data));
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      eventSource.close();
      void leave();
    };
  }, [join, leave, sessionId]);

  useEffect(() => {
    const updatePresence = async () => {
      try {
        await fetch(`/api/sessions/${sessionId}/presence`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
      } catch {
        // Ignore presence update errors
      }
    };

    const interval = window.setInterval(updatePresence, 15000);

    return () => window.clearInterval(interval);
  }, [sessionId, userId]);

  const memoizedState = useMemo(() => state, [state]);

  return { state: memoizedState, join, leave };
}
