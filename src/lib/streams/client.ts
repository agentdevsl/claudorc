/**
 * Durable Streams Client
 *
 * Client-side wrapper for durable streams with:
 * - Automatic reconnection with exponential backoff
 * - Offset-based resume for missed events
 * - Typed event callbacks
 *
 * @module lib/streams/client
 */

import { z } from 'zod';
import type {
  SessionAgentState,
  SessionChunk,
  SessionPresence,
  SessionTerminal,
  SessionToolCall,
} from '../../app/hooks/use-session';

// Re-export types for convenience
export type { SessionChunk, SessionToolCall, SessionPresence, SessionTerminal, SessionAgentState };

/**
 * Zod schemas for validating raw event data from server
 * These are partial schemas since some fields come from the event envelope
 */
const rawChunkDataSchema = z.object({
  text: z.string().default(''),
  agentId: z.string().optional(),
});

const rawToolCallDataSchema = z.object({
  id: z.string().min(1).optional(),
  tool: z.string().default('unknown'),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
});

const rawPresenceDataSchema = z.object({
  userId: z.string().min(1),
  cursor: z
    .object({
      x: z.number(),
      y: z.number(),
    })
    .optional(),
});

const rawTerminalDataSchema = z.object({
  data: z.string().default(''),
});

const rawAgentStateDataSchema = z.object({
  agentId: z.string().min(1).optional(),
  sessionId: z.string().min(1).optional(),
  status: z.enum(['idle', 'starting', 'running', 'paused', 'error', 'completed']).optional(),
  taskId: z.string().optional(),
  turn: z.number().optional(),
  progress: z.number().optional(),
  currentTool: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

/**
 * Reconnection configuration
 */
export interface ReconnectConfig {
  /** Whether reconnection is enabled */
  enabled: boolean;
  /** Initial delay in ms before first reconnect attempt */
  initialDelay: number;
  /** Maximum delay in ms between reconnect attempts */
  maxDelay: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
}

/**
 * Default reconnection configuration
 */
export const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  enabled: true,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

/**
 * Session event types from the server
 */
export type SessionEventType =
  | 'chunk'
  | 'tool:start'
  | 'tool:result'
  | 'presence:joined'
  | 'presence:left'
  | 'presence:cursor'
  | 'terminal:input'
  | 'terminal:output'
  | 'state:update';

/**
 * Raw event from the server
 */
export interface RawSessionEvent {
  type: SessionEventType;
  data: unknown;
  timestamp: number;
  offset?: number;
}

/**
 * Typed session event for callback routing
 */
export type TypedSessionEvent =
  | { channel: 'chunks'; data: SessionChunk; offset?: number }
  | { channel: 'toolCalls'; data: SessionToolCall; offset?: number }
  | { channel: 'presence'; data: SessionPresence; offset?: number }
  | { channel: 'terminal'; data: SessionTerminal; offset?: number }
  | { channel: 'agentState'; data: SessionAgentState; offset?: number };

/**
 * Callbacks for session subscription
 */
export interface SessionCallbacks {
  onChunk?: (event: { channel: 'chunks'; data: SessionChunk; offset?: number }) => void;
  onToolCall?: (event: { channel: 'toolCalls'; data: SessionToolCall; offset?: number }) => void;
  onPresence?: (event: { channel: 'presence'; data: SessionPresence; offset?: number }) => void;
  onTerminal?: (event: { channel: 'terminal'; data: SessionTerminal; offset?: number }) => void;
  onAgentState?: (event: {
    channel: 'agentState';
    data: SessionAgentState;
    offset?: number;
  }) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
  onDisconnect?: () => void;
}

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/**
 * Subscription handle returned by subscribe functions
 */
export interface Subscription {
  /** Unsubscribe and close the connection */
  unsubscribe: () => void;
  /** Get current connection state */
  getState: () => ConnectionState;
  /** Get the last received offset for resume */
  getLastOffset: () => number;
}

/**
 * Durable Streams Client
 *
 * Wraps EventSource with automatic reconnection and offset tracking.
 */
export class DurableStreamsClient {
  private baseUrl: string;
  private reconnectConfig: ReconnectConfig;

  constructor(options: { url: string; reconnect?: Partial<ReconnectConfig> }) {
    this.baseUrl = options.url;
    this.reconnectConfig = {
      ...DEFAULT_RECONNECT_CONFIG,
      ...options.reconnect,
    };
  }

  /**
   * Subscribe to a session's event stream
   */
  subscribeToSession(sessionId: string, callbacks: SessionCallbacks): Subscription {
    let eventSource: EventSource | null = null;
    let state: ConnectionState = 'disconnected';
    let lastOffset = 0;
    let reconnectAttempts = 0;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
    let isUnsubscribed = false;

    const connect = (fromOffset?: number) => {
      if (isUnsubscribed) return;

      state = reconnectAttempts > 0 ? 'reconnecting' : 'connecting';

      // Build URL with offset for resume
      const url = new URL(`${this.baseUrl}/${sessionId}/stream`, window.location.origin);
      if (fromOffset !== undefined && fromOffset > 0) {
        url.searchParams.set('offset', String(fromOffset));
      }

      eventSource = new EventSource(url.toString());

      eventSource.onopen = () => {
        state = 'connected';
        reconnectAttempts = 0;

        if (fromOffset !== undefined && fromOffset > 0) {
          callbacks.onReconnect?.();
        }
      };

      eventSource.onmessage = (event) => {
        try {
          const rawEvent = JSON.parse(event.data) as RawSessionEvent;

          // Track offset for resume
          if (rawEvent.offset !== undefined) {
            lastOffset = rawEvent.offset;
          }

          // Route to typed callbacks
          const typedEvent = mapRawEventToTyped(rawEvent);
          if (typedEvent) {
            routeEventToCallback(typedEvent, callbacks);
          }
        } catch (error) {
          callbacks.onError?.(error instanceof Error ? error : new Error('Failed to parse event'));
        }
      };

      eventSource.onerror = () => {
        const wasConnected = state === 'connected';
        state = 'disconnected';
        eventSource?.close();
        eventSource = null;

        if (wasConnected) {
          callbacks.onDisconnect?.();
        }

        // Attempt reconnection if enabled and not unsubscribed
        if (this.reconnectConfig.enabled && !isUnsubscribed) {
          scheduleReconnect();
        } else {
          callbacks.onError?.(new Error('Connection closed'));
        }
      };
    };

    const scheduleReconnect = () => {
      if (isUnsubscribed || reconnectTimeout) return;

      reconnectAttempts++;

      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.reconnectConfig.initialDelay *
          this.reconnectConfig.backoffMultiplier ** (reconnectAttempts - 1),
        this.reconnectConfig.maxDelay
      );

      reconnectTimeout = setTimeout(() => {
        reconnectTimeout = null;
        connect(lastOffset);
      }, delay);
    };

    const unsubscribe = () => {
      isUnsubscribed = true;
      state = 'disconnected';

      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };

    // Start initial connection
    connect();

    return {
      unsubscribe,
      getState: () => state,
      getLastOffset: () => lastOffset,
    };
  }

  /**
   * Subscribe to agent-specific events
   */
  subscribeToAgent(
    agentId: string,
    callbacks: {
      onState: (event: { channel: 'agentState'; data: SessionAgentState }) => void;
      onStep: (event: TypedSessionEvent) => void;
      onError?: (error: Error) => void;
      onReconnect?: () => void;
    }
  ): Subscription {
    // Agent subscriptions use the same infrastructure but filter by agent
    return this.subscribeToSession(`agent:${agentId}`, {
      onAgentState: callbacks.onState,
      onChunk: callbacks.onStep,
      onToolCall: callbacks.onStep,
      onTerminal: callbacks.onStep,
      onError: callbacks.onError,
      onReconnect: callbacks.onReconnect,
    });
  }
}

/**
 * Map raw server event to typed channel event with Zod validation
 */
function mapRawEventToTyped(raw: RawSessionEvent): TypedSessionEvent | null {
  switch (raw.type) {
    case 'chunk': {
      const parsed = rawChunkDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid chunk event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'chunks',
        data: {
          text: parsed.data.text,
          timestamp: raw.timestamp,
          agentId: parsed.data.agentId,
        },
        offset: raw.offset,
      };
    }

    case 'tool:start': {
      const parsed = rawToolCallDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid tool:start event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'toolCalls',
        data: {
          id: parsed.data.id ?? crypto.randomUUID(),
          tool: parsed.data.tool,
          input: parsed.data.input,
          status: 'running',
          timestamp: raw.timestamp,
        },
        offset: raw.offset,
      };
    }

    case 'tool:result': {
      const parsed = rawToolCallDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid tool:result event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'toolCalls',
        data: {
          id: parsed.data.id ?? '',
          tool: parsed.data.tool,
          input: parsed.data.input,
          output: parsed.data.output,
          status: 'complete',
          timestamp: raw.timestamp,
        },
        offset: raw.offset,
      };
    }

    case 'presence:joined':
    case 'presence:left':
    case 'presence:cursor': {
      const parsed = rawPresenceDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid presence event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'presence',
        data: {
          userId: parsed.data.userId,
          lastSeen: raw.timestamp,
          cursor: parsed.data.cursor,
        },
        offset: raw.offset,
      };
    }

    case 'terminal:input':
    case 'terminal:output': {
      const parsed = rawTerminalDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid terminal event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'terminal',
        data: {
          type: raw.type === 'terminal:input' ? 'input' : 'output',
          data: parsed.data.data,
          timestamp: raw.timestamp,
        },
        offset: raw.offset,
      };
    }

    case 'state:update': {
      const parsed = rawAgentStateDataSchema.safeParse(raw.data);
      if (!parsed.success) {
        console.warn(
          '[DurableStreamsClient] Invalid state:update event data:',
          parsed.error.message,
          'raw:',
          raw.data
        );
        return null;
      }
      return {
        channel: 'agentState',
        data: parsed.data as SessionAgentState,
        offset: raw.offset,
      };
    }

    default:
      console.warn(
        '[DurableStreamsClient] Unknown event type received:',
        raw.type,
        'data:',
        raw.data
      );
      return null;
  }
}

/**
 * Route typed event to appropriate callback
 */
function routeEventToCallback(event: TypedSessionEvent, callbacks: SessionCallbacks): void {
  switch (event.channel) {
    case 'chunks':
      callbacks.onChunk?.(event);
      break;
    case 'toolCalls':
      callbacks.onToolCall?.(event);
      break;
    case 'presence':
      callbacks.onPresence?.(event);
      break;
    case 'terminal':
      callbacks.onTerminal?.(event);
      break;
    case 'agentState':
      callbacks.onAgentState?.(event);
      break;
  }
}

// Create singleton client instance
let clientInstance: DurableStreamsClient | null = null;

/**
 * Get or create the durable streams client
 */
export function getDurableStreamsClient(): DurableStreamsClient {
  if (!clientInstance) {
    clientInstance = new DurableStreamsClient({
      url: '/api/sessions',
      reconnect: DEFAULT_RECONNECT_CONFIG,
    });
  }
  return clientInstance;
}

/**
 * Convenience function to subscribe to a session
 */
export function subscribeToSession(sessionId: string, callbacks: SessionCallbacks): Subscription {
  return getDurableStreamsClient().subscribeToSession(sessionId, callbacks);
}

/**
 * Convenience function to subscribe to an agent
 */
export function subscribeToAgent(
  agentId: string,
  callbacks: {
    onState: (event: { channel: 'agentState'; data: SessionAgentState }) => void;
    onStep: (event: TypedSessionEvent) => void;
    onError?: (error: Error) => void;
    onReconnect?: () => void;
  }
): Subscription {
  return getDurableStreamsClient().subscribeToAgent(agentId, callbacks);
}
