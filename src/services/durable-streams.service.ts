import { createId } from '@paralleldrive/cuid2';
import type { SessionEvent, SessionEventType } from './session.service.js';

/**
 * Durable Streams server interface for real-time event streaming
 */
export interface DurableStreamsServer {
  createStream: (id: string, schema: unknown) => Promise<void>;
  publish: (id: string, type: string, data: unknown) => Promise<void>;
  subscribe: (id: string) => AsyncIterable<{ type: string; data: unknown }>;
}

/**
 * Plan mode specific event types
 */
export type PlanModeEventType =
  | 'plan:started'
  | 'plan:turn'
  | 'plan:token'
  | 'plan:interaction'
  | 'plan:completed'
  | 'plan:error'
  | 'plan:cancelled';

/**
 * Sandbox specific event types
 */
export type SandboxEventType =
  | 'sandbox:creating'
  | 'sandbox:ready'
  | 'sandbox:idle'
  | 'sandbox:stopping'
  | 'sandbox:stopped'
  | 'sandbox:error'
  | 'sandbox:tmux:created'
  | 'sandbox:tmux:destroyed';

/**
 * Task creation specific event types
 */
export type TaskCreationEventType =
  | 'task-creation:started'
  | 'task-creation:message'
  | 'task-creation:token'
  | 'task-creation:suggestion'
  | 'task-creation:completed'
  | 'task-creation:cancelled'
  | 'task-creation:error';

/**
 * Combined event type for all stream events
 */
export type StreamEventType =
  | SessionEventType
  | PlanModeEventType
  | SandboxEventType
  | TaskCreationEventType;

/**
 * Generic stream event
 */
export interface StreamEvent<T = unknown> {
  id: string;
  type: StreamEventType;
  timestamp: number;
  data: T;
}

/**
 * Plan mode events
 */
export interface PlanStartedEvent {
  sessionId: string;
  taskId: string;
  projectId: string;
}

export interface PlanTurnEvent {
  sessionId: string;
  turnId: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface PlanTokenEvent {
  sessionId: string;
  delta: string;
  accumulated: string;
}

export interface PlanInteractionEvent {
  sessionId: string;
  interactionId: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{ label: string; description: string }>;
    multiSelect: boolean;
  }>;
}

export interface PlanCompletedEvent {
  sessionId: string;
  issueUrl?: string;
  issueNumber?: number;
}

export interface PlanErrorEvent {
  sessionId: string;
  error: string;
  code?: string;
}

/**
 * Sandbox events
 */
export interface SandboxCreatingEvent {
  sandboxId: string;
  projectId: string;
  image: string;
}

export interface SandboxReadyEvent {
  sandboxId: string;
  projectId: string;
  containerId: string;
}

export interface SandboxIdleEvent {
  sandboxId: string;
  projectId: string;
  idleSince: number;
  timeoutMinutes: number;
}

export interface SandboxStoppingEvent {
  sandboxId: string;
  projectId: string;
  reason: 'idle_timeout' | 'manual' | 'error';
}

export interface SandboxStoppedEvent {
  sandboxId: string;
  projectId: string;
}

export interface SandboxErrorEvent {
  sandboxId: string;
  projectId: string;
  error: string;
  code?: string;
}

export interface SandboxTmuxCreatedEvent {
  sandboxId: string;
  sessionName: string;
  taskId?: string;
}

export interface SandboxTmuxDestroyedEvent {
  sandboxId: string;
  sessionName: string;
}

/**
 * Task creation events
 */
export interface TaskCreationStartedEvent {
  sessionId: string;
  projectId: string;
}

export interface TaskCreationMessageEvent {
  sessionId: string;
  messageId: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface TaskCreationTokenEvent {
  sessionId: string;
  delta: string;
  accumulated: string;
}

export interface TaskCreationSuggestionEvent {
  sessionId: string;
  suggestion: {
    title: string;
    description: string;
    labels: string[];
    priority: 'high' | 'medium' | 'low';
  };
}

export interface TaskCreationCompletedEvent {
  sessionId: string;
  taskId: string;
  suggestion: {
    title: string;
    description: string;
    labels: string[];
    priority: 'high' | 'medium' | 'low';
  };
}

export interface TaskCreationCancelledEvent {
  sessionId: string;
}

export interface TaskCreationErrorEvent {
  sessionId: string;
  error: string;
  code?: string;
}

/**
 * DurableStreamsService provides a centralized interface for real-time event streaming.
 *
 * Two subscription mechanisms are available:
 * 1. Local synchronous callbacks via addSubscriber() - for immediate in-process notifications
 * 2. Async iteration via subscribe() - for cross-process/distributed scenarios through the server
 *
 * The service wraps the underlying Durable Streams server and maintains a local subscriber
 * map for fast in-process event delivery alongside the distributed streaming capability.
 */
export class DurableStreamsService {
  private subscribers = new Map<string, Set<(event: StreamEvent) => void>>();

  constructor(private server: DurableStreamsServer) {}

  /**
   * Create a new stream for a session or plan
   */
  async createStream(id: string, schema: unknown): Promise<void> {
    await this.server.createStream(id, schema);
    this.subscribers.set(id, new Set());
  }

  /**
   * Publish a generic event to a stream
   */
  async publish<T>(streamId: string, type: StreamEventType, data: T): Promise<void> {
    await this.server.publish(streamId, type, data);

    // Notify local subscribers
    const event: StreamEvent<T> = {
      id: createId(),
      type,
      timestamp: Date.now(),
      data,
    };
    this.notifySubscribers(streamId, event);
  }

  /**
   * Subscribe to a stream and receive events
   */
  async *subscribe(streamId: string): AsyncIterable<StreamEvent> {
    const subscription = this.server.subscribe(streamId);
    for await (const event of subscription) {
      yield {
        id: createId(),
        type: event.type as StreamEventType,
        timestamp: Date.now(),
        data: event.data,
      };
    }
  }

  /**
   * Add a local subscriber for immediate event notification
   */
  addSubscriber(streamId: string, callback: (event: StreamEvent) => void): () => void {
    const subscribers = this.subscribers.get(streamId) ?? new Set();
    subscribers.add(callback);
    this.subscribers.set(streamId, subscribers);

    return () => {
      subscribers.delete(callback);
    };
  }

  private notifySubscribers(streamId: string, event: StreamEvent): void {
    const subscribers = this.subscribers.get(streamId);
    if (subscribers) {
      for (const callback of subscribers) {
        try {
          callback(event);
        } catch (error) {
          console.error(`[DurableStreamsService] Subscriber error for ${streamId}:`, error);
        }
      }
    }
  }

  // ============================================
  // Plan Mode Event Helpers
  // ============================================

  async publishPlanStarted(streamId: string, data: PlanStartedEvent): Promise<void> {
    await this.publish(streamId, 'plan:started', data);
  }

  async publishPlanTurn(streamId: string, data: PlanTurnEvent): Promise<void> {
    await this.publish(streamId, 'plan:turn', data);
  }

  async publishPlanToken(streamId: string, data: PlanTokenEvent): Promise<void> {
    await this.publish(streamId, 'plan:token', data);
  }

  async publishPlanInteraction(streamId: string, data: PlanInteractionEvent): Promise<void> {
    await this.publish(streamId, 'plan:interaction', data);
  }

  async publishPlanCompleted(streamId: string, data: PlanCompletedEvent): Promise<void> {
    await this.publish(streamId, 'plan:completed', data);
  }

  async publishPlanError(streamId: string, data: PlanErrorEvent): Promise<void> {
    await this.publish(streamId, 'plan:error', data);
  }

  // ============================================
  // Sandbox Event Helpers
  // ============================================

  async publishSandboxCreating(streamId: string, data: SandboxCreatingEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:creating', data);
  }

  async publishSandboxReady(streamId: string, data: SandboxReadyEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:ready', data);
  }

  async publishSandboxIdle(streamId: string, data: SandboxIdleEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:idle', data);
  }

  async publishSandboxStopping(streamId: string, data: SandboxStoppingEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:stopping', data);
  }

  async publishSandboxStopped(streamId: string, data: SandboxStoppedEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:stopped', data);
  }

  async publishSandboxError(streamId: string, data: SandboxErrorEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:error', data);
  }

  async publishSandboxTmuxCreated(streamId: string, data: SandboxTmuxCreatedEvent): Promise<void> {
    await this.publish(streamId, 'sandbox:tmux:created', data);
  }

  async publishSandboxTmuxDestroyed(
    streamId: string,
    data: SandboxTmuxDestroyedEvent
  ): Promise<void> {
    await this.publish(streamId, 'sandbox:tmux:destroyed', data);
  }

  // ============================================
  // Session Event Helpers (delegating to existing types)
  // ============================================

  async publishSessionEvent(streamId: string, event: SessionEvent): Promise<void> {
    await this.server.publish(streamId, event.type, event.data);
  }

  // ============================================
  // Task Creation Event Helpers
  // ============================================

  async publishTaskCreationStarted(
    streamId: string,
    data: TaskCreationStartedEvent
  ): Promise<void> {
    await this.publish(streamId, 'task-creation:started', data);
  }

  async publishTaskCreationMessage(
    streamId: string,
    data: TaskCreationMessageEvent
  ): Promise<void> {
    await this.publish(streamId, 'task-creation:message', data);
  }

  async publishTaskCreationToken(streamId: string, data: TaskCreationTokenEvent): Promise<void> {
    await this.publish(streamId, 'task-creation:token', data);
  }

  async publishTaskCreationSuggestion(
    streamId: string,
    data: TaskCreationSuggestionEvent
  ): Promise<void> {
    await this.publish(streamId, 'task-creation:suggestion', data);
  }

  async publishTaskCreationCompleted(
    streamId: string,
    data: TaskCreationCompletedEvent
  ): Promise<void> {
    await this.publish(streamId, 'task-creation:completed', data);
  }

  async publishTaskCreationCancelled(
    streamId: string,
    data: TaskCreationCancelledEvent
  ): Promise<void> {
    await this.publish(streamId, 'task-creation:cancelled', data);
  }

  async publishTaskCreationError(streamId: string, data: TaskCreationErrorEvent): Promise<void> {
    await this.publish(streamId, 'task-creation:error', data);
  }

  /**
   * Get the underlying server for advanced operations
   */
  getServer(): DurableStreamsServer {
    return this.server;
  }
}
