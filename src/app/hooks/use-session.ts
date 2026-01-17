import { useCallback, useEffect, useMemo, useState } from 'react';
import { useServices } from '@/app/services/service-context';
import { SessionErrors } from '@/lib/errors/session-errors';
import { err, ok, type Result } from '@/lib/utils/result';
import type { SessionEvent } from '@/services/session.service';

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
  const { sessionService } = useServices();
  const [state, setState] = useState<SessionState>(initialState);

  const join = useCallback(async () => {
    const result = await sessionService.join(sessionId, userId);
    if (!result.ok) {
      return err(SessionErrors.CONNECTION_FAILED(result.error.message));
    }
    return ok(undefined);
  }, [sessionId, sessionService, userId]);

  const leave = useCallback(async () => {
    const result = await sessionService.leave(sessionId, userId);
    if (!result.ok) {
      return err(SessionErrors.CONNECTION_FAILED(result.error.message));
    }
    return ok(undefined);
  }, [sessionId, sessionService, userId]);

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
    const interval = window.setInterval(() => {
      void sessionService.updatePresence(sessionId, userId, {});
    }, 15000);

    return () => window.clearInterval(interval);
  }, [sessionId, sessionService, userId]);

  const memoizedState = useMemo(() => state, [state]);

  return { state: memoizedState, join, leave };
}
