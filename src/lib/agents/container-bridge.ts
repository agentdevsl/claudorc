/**
 * Container Bridge - Parses JSON stdout from container agent-runner and bridges events to DurableStreams.
 *
 * The agent-runner inside Docker containers emits JSON-line events to stdout.
 * This bridge reads those lines, parses them, and publishes to the appropriate DurableStreams stream.
 */
import { createInterface, type Interface } from 'node:readline';
import type { Readable } from 'node:stream';
import type {
  DurableStreamsService,
  StreamEventMap,
  TypedEventType,
} from '../../services/durable-streams.service.js';

// Debug logging helper
const DEBUG = process.env.DEBUG_CONTAINER_BRIDGE === 'true' || process.env.DEBUG === 'true';

function debugLog(context: string, message: string, data?: Record<string, unknown>): void {
  if (DEBUG) {
    const timestamp = new Date().toISOString();
    const dataStr = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[${timestamp}] [ContainerBridge:${context}] ${message}${dataStr}`);
  }
}

function infoLog(context: string, message: string, data?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const dataStr = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${timestamp}] [ContainerBridge:${context}] ${message}${dataStr}`);
}

/**
 * Event types emitted by the container agent-runner.
 */
export type ContainerAgentEventType =
  | 'agent:started'
  | 'agent:token'
  | 'agent:turn'
  | 'agent:tool:start'
  | 'agent:tool:result'
  | 'agent:message'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:cancelled';

/**
 * Raw event structure from the container stdout.
 */
export interface ContainerAgentEvent {
  type: ContainerAgentEventType;
  timestamp: number;
  taskId: string;
  sessionId: string;
  data: Record<string, unknown>;
}

/**
 * Maps container event types to DurableStreams event types.
 */
const EVENT_TYPE_MAP: Record<ContainerAgentEventType, TypedEventType> = {
  'agent:started': 'container-agent:started',
  'agent:token': 'container-agent:token',
  'agent:turn': 'container-agent:turn',
  'agent:tool:start': 'container-agent:tool:start',
  'agent:tool:result': 'container-agent:tool:result',
  'agent:message': 'container-agent:message',
  'agent:complete': 'container-agent:complete',
  'agent:error': 'container-agent:error',
  'agent:cancelled': 'container-agent:cancelled',
};

/**
 * Options for creating a container bridge.
 */
export interface ContainerBridgeOptions {
  taskId: string;
  sessionId: string;
  projectId: string;
  streams: DurableStreamsService;
  onComplete?: (status: 'completed' | 'turn_limit' | 'cancelled', turnCount: number) => void;
  onError?: (error: string, turnCount: number) => void;
}

/**
 * Container bridge instance.
 */
export interface ContainerBridge {
  /**
   * Process a stdout stream from the container.
   */
  processStream(stream: Readable): Promise<void>;

  /**
   * Stop processing and clean up.
   */
  stop(): void;
}

/**
 * Create a container bridge for processing agent events from Docker stdout.
 */
export function createContainerBridge(options: ContainerBridgeOptions): ContainerBridge {
  const { taskId, sessionId, projectId, streams, onComplete, onError } = options;
  let readline: Interface | null = null;
  let stopped = false;
  let lineCount = 0;
  let eventCount = 0;

  debugLog('createContainerBridge', 'Creating container bridge', { taskId, sessionId, projectId });

  /**
   * Parse a JSON line from stdout.
   */
  function parseLine(line: string): ContainerAgentEvent | null {
    const trimmed = line.trim();
    if (!trimmed) {
      return null;
    }

    try {
      const event = JSON.parse(trimmed) as ContainerAgentEvent;

      // Validate event structure
      if (!event.type || !event.timestamp || !event.taskId || !event.sessionId) {
        infoLog('parseLine', 'Invalid event structure', {
          line: trimmed.slice(0, 200),
          hasType: !!event.type,
          hasTimestamp: !!event.timestamp,
          hasTaskId: !!event.taskId,
          hasSessionId: !!event.sessionId,
        });
        return null;
      }

      debugLog('parseLine', 'Parsed event', {
        type: event.type,
        taskId: event.taskId,
        dataKeys: Object.keys(event.data || {}),
      });

      return event;
    } catch (parseError) {
      // Check if this looks like it was supposed to be JSON (starts with { or [)
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        // This was probably malformed JSON from agent-runner - this is a problem worth noting
        infoLog(
          'parseLine',
          'Malformed JSON event - possible agent-runner bug or stream corruption',
          {
            linePreview: trimmed.slice(0, 200),
            error: parseError instanceof Error ? parseError.message : String(parseError),
          }
        );
      } else {
        // Regular non-JSON stdout from commands - expected behavior
        debugLog('parseLine', 'Non-JSON output', { line: trimmed.slice(0, 100) });
      }
      return null;
    }
  }

  /**
   * Publish an event to DurableStreams.
   */
  async function publishEvent(event: ContainerAgentEvent): Promise<void> {
    const streamType = EVENT_TYPE_MAP[event.type];
    if (!streamType) {
      infoLog('publishEvent', 'Unknown event type', { type: event.type });
      return;
    }

    // Build event data with task/session context
    const eventData = {
      taskId,
      sessionId,
      projectId, // Include projectId for context
      ...event.data,
    };

    debugLog('publishEvent', 'Publishing event to DurableStreams', {
      type: streamType,
      sessionId,
      dataKeys: Object.keys(eventData),
    });

    try {
      await streams.publish(sessionId, streamType, eventData as StreamEventMap[typeof streamType]);
      debugLog('publishEvent', 'Event published successfully', { type: streamType });
    } catch (error) {
      infoLog('publishEvent', 'Failed to publish event', {
        type: streamType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle completion event.
   */
  function handleComplete(event: ContainerAgentEvent): void {
    const data = event.data as {
      status: 'completed' | 'turn_limit' | 'cancelled';
      turnCount: number;
    };

    infoLog('handleComplete', 'Agent completed', {
      taskId,
      status: data.status,
      turnCount: data.turnCount,
      totalLines: lineCount,
      totalEvents: eventCount,
    });

    if (onComplete) {
      onComplete(data.status, data.turnCount);
    }
  }

  /**
   * Handle error event.
   */
  function handleError(event: ContainerAgentEvent): void {
    const data = event.data as {
      error: string;
      turnCount: number;
    };

    infoLog('handleError', 'Agent error received', {
      taskId,
      error: data.error,
      turnCount: data.turnCount,
      totalLines: lineCount,
      totalEvents: eventCount,
    });

    if (onError) {
      onError(data.error, data.turnCount);
    }
  }

  /**
   * Handle cancelled event.
   */
  function handleCancelled(event: ContainerAgentEvent): void {
    const data = event.data as { turnCount: number };

    infoLog('handleCancelled', 'Agent cancelled', {
      taskId,
      turnCount: data.turnCount,
      totalLines: lineCount,
      totalEvents: eventCount,
    });

    if (onComplete) {
      onComplete('cancelled', data.turnCount);
    }
  }

  return {
    async processStream(stream: Readable): Promise<void> {
      if (stopped) {
        debugLog('processStream', 'Bridge already stopped, skipping', { taskId });
        return;
      }

      infoLog('processStream', 'Starting to process stdout stream', { taskId, sessionId });

      readline = createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      // Process each line
      for await (const line of readline) {
        lineCount++;

        if (stopped) {
          debugLog('processStream', 'Bridge stopped during processing', { taskId, lineCount });
          break;
        }

        const event = parseLine(line);
        if (!event) {
          continue;
        }

        eventCount++;

        // Verify event belongs to this task/session
        if (event.taskId !== taskId || event.sessionId !== sessionId) {
          infoLog('processStream', 'Event task/session mismatch', {
            expected: { taskId, sessionId },
            received: { taskId: event.taskId, sessionId: event.sessionId },
          });
          continue;
        }

        // Publish event
        await publishEvent(event);

        // Handle terminal events
        if (event.type === 'agent:complete') {
          handleComplete(event);
        } else if (event.type === 'agent:error') {
          handleError(event);
        } else if (event.type === 'agent:cancelled') {
          handleCancelled(event);
        }
      }

      infoLog('processStream', 'Stream processing complete', {
        taskId,
        totalLines: lineCount,
        totalEvents: eventCount,
      });
    },

    stop(): void {
      infoLog('stop', 'Stopping container bridge', { taskId, lineCount, eventCount });
      stopped = true;
      if (readline) {
        readline.close();
        readline = null;
      }
    },
  };
}

/**
 * Process a single line of JSON output (for testing or manual processing).
 */
export function parseContainerEvent(line: string): ContainerAgentEvent | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const event = JSON.parse(trimmed) as ContainerAgentEvent;

    if (!event.type || !event.timestamp || !event.taskId || !event.sessionId) {
      return null;
    }

    return event;
  } catch {
    return null;
  }
}
