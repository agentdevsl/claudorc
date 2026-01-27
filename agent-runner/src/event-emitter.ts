/**
 * Event emitter for container-to-host communication.
 * Outputs JSON-line events to stdout for parsing by the host process.
 */

export type AgentEventType =
  | 'agent:started'
  | 'agent:token'
  | 'agent:turn'
  | 'agent:tool:start'
  | 'agent:tool:result'
  | 'agent:message'
  | 'agent:complete'
  | 'agent:error'
  | 'agent:cancelled';

export interface AgentEvent {
  type: AgentEventType;
  timestamp: number;
  taskId: string;
  sessionId: string;
  data: Record<string, unknown>;
}

export interface AgentStartedData {
  model: string;
  maxTurns: number;
}

export interface AgentTokenData {
  delta: string;
  accumulated: string;
}

export interface AgentTurnData {
  turn: number;
  maxTurns: number;
  remaining: number;
}

export interface AgentToolStartData {
  toolName: string;
  toolId: string;
  input: Record<string, unknown>;
}

export interface AgentToolResultData {
  toolName: string;
  toolId: string;
  result: string;
  isError: boolean;
  durationMs: number;
}

export interface AgentMessageData {
  role: 'user' | 'assistant';
  content: string;
}

export interface AgentCompleteData {
  status: 'completed' | 'turn_limit' | 'cancelled';
  turnCount: number;
  result?: string;
}

export interface AgentErrorData {
  error: string;
  code?: string;
  turnCount: number;
}

/**
 * EventEmitter class for emitting agent events as JSON lines to stdout.
 * The host process reads these lines and bridges them to DurableStreams.
 */
export class EventEmitter {
  constructor(
    private readonly taskId: string,
    private readonly sessionId: string
  ) {}

  /**
   * Emit an event to stdout as a JSON line.
   * The host process parses these lines to bridge events to DurableStreams.
   */
  emit(type: AgentEventType, data: Record<string, unknown>): void {
    const event: AgentEvent = {
      type,
      timestamp: Date.now(),
      taskId: this.taskId,
      sessionId: this.sessionId,
      data,
    };

    // Write as a single JSON line to stdout
    // The host process reads line-by-line and parses JSON
    process.stdout.write(`${JSON.stringify(event)}\n`);
  }

  started(data: AgentStartedData): void {
    this.emit('agent:started', { ...data });
  }

  token(data: AgentTokenData): void {
    this.emit('agent:token', { ...data });
  }

  turn(data: AgentTurnData): void {
    this.emit('agent:turn', { ...data });
  }

  toolStart(data: AgentToolStartData): void {
    this.emit('agent:tool:start', { ...data });
  }

  toolResult(data: AgentToolResultData): void {
    this.emit('agent:tool:result', { ...data });
  }

  message(data: AgentMessageData): void {
    this.emit('agent:message', { ...data });
  }

  complete(data: AgentCompleteData): void {
    this.emit('agent:complete', { ...data });
  }

  error(data: AgentErrorData): void {
    this.emit('agent:error', { ...data });
  }

  cancelled(turnCount: number): void {
    this.emit('agent:cancelled', { turnCount });
  }
}

/**
 * Create an event emitter for a specific task and session.
 */
export function createEventEmitter(taskId: string, sessionId: string): EventEmitter {
  return new EventEmitter(taskId, sessionId);
}
