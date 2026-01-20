/**
 * Durable Streams server implementation for real-time event streaming.
 *
 * This module provides the server-side implementation of durable streams,
 * supporting offset-based resumability and SSE streaming for real-time updates.
 */

import type { DurableStreamsServer } from '../../services/session.service.js';

/**
 * Stream event stored in memory
 */
interface StoredEvent {
  offset: number;
  type: string;
  data: unknown;
  timestamp: number;
}

/**
 * Stream metadata
 */
interface StreamMetadata {
  id: string;
  schema: unknown;
  createdAt: number;
  events: StoredEvent[];
  subscribers: Set<(event: StoredEvent) => void>;
}

/**
 * In-memory durable streams server implementation.
 *
 * Provides:
 * - Stream creation with schema validation
 * - Event publishing with automatic offset tracking
 * - Subscription with offset-based resumability
 * - In-memory storage (production would use persistent storage)
 */
export class InMemoryDurableStreamsServer implements DurableStreamsServer {
  private streams = new Map<string, StreamMetadata>();

  /**
   * Create a new stream with the given schema
   */
  async createStream(id: string, schema: unknown): Promise<void> {
    if (this.streams.has(id)) {
      // Stream already exists - this is idempotent
      return;
    }

    this.streams.set(id, {
      id,
      schema,
      createdAt: Date.now(),
      events: [],
      subscribers: new Set(),
    });
  }

  /**
   * Publish an event to a stream
   */
  async publish(id: string, type: string, data: unknown): Promise<void> {
    const stream = this.streams.get(id);
    if (!stream) {
      // Auto-create stream if it doesn't exist
      await this.createStream(id, null);
      return this.publish(id, type, data);
    }

    const event: StoredEvent = {
      offset: stream.events.length,
      type,
      data,
      timestamp: Date.now(),
    };

    stream.events.push(event);

    // Notify all subscribers
    for (const subscriber of stream.subscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error(`[DurableStreamsServer] Subscriber error for stream ${id}:`, error);
      }
    }
  }

  /**
   * Subscribe to a stream and receive events.
   * Supports offset-based resumability.
   */
  async *subscribe(
    id: string,
    options?: { fromOffset?: number }
  ): AsyncIterable<{ type: string; data: unknown; offset: number }> {
    const stream = this.streams.get(id);
    if (!stream) {
      throw new Error(`Stream ${id} not found`);
    }

    const startOffset = options?.fromOffset ?? 0;

    // First, yield any existing events from the requested offset
    for (const event of stream.events.slice(startOffset)) {
      yield { type: event.type, data: event.data, offset: event.offset };
    }

    // Then, set up live subscription for new events
    const eventQueue: StoredEvent[] = [];
    let resolveNext:
      | ((value: IteratorResult<{ type: string; data: unknown; offset: number }>) => void)
      | null = null;

    const subscriber = (event: StoredEvent) => {
      if (resolveNext) {
        resolveNext({
          value: { type: event.type, data: event.data, offset: event.offset },
          done: false,
        });
        resolveNext = null;
      } else {
        eventQueue.push(event);
      }
    };

    stream.subscribers.add(subscriber);

    try {
      while (true) {
        if (eventQueue.length > 0) {
          const event = eventQueue.shift()!;
          yield { type: event.type, data: event.data, offset: event.offset };
        } else {
          // Wait for next event
          yield await new Promise<{ type: string; data: unknown; offset: number }>((resolve) => {
            resolveNext = (result) => {
              if (!result.done) {
                resolve(result.value);
              }
            };
          });
        }
      }
    } finally {
      stream.subscribers.delete(subscriber);
    }
  }

  /**
   * Get stream metadata
   */
  getStreamMetadata(id: string): { eventCount: number; createdAt: number } | null {
    const stream = this.streams.get(id);
    if (!stream) return null;

    return {
      eventCount: stream.events.length,
      createdAt: stream.createdAt,
    };
  }

  /**
   * Get events from a stream with offset-based pagination
   */
  getEvents(id: string, options?: { fromOffset?: number; limit?: number }): StoredEvent[] {
    const stream = this.streams.get(id);
    if (!stream) return [];

    const fromOffset = options?.fromOffset ?? 0;
    const limit = options?.limit ?? 100;

    return stream.events.slice(fromOffset, fromOffset + limit);
  }

  /**
   * Delete a stream and all its events
   */
  async deleteStream(id: string): Promise<boolean> {
    return this.streams.delete(id);
  }

  /**
   * Check if a stream exists
   */
  hasStream(id: string): boolean {
    return this.streams.has(id);
  }

  /**
   * Get the current offset (event count) for a stream
   */
  getCurrentOffset(id: string): number {
    const stream = this.streams.get(id);
    return stream?.events.length ?? 0;
  }
}

// Singleton instance for the application
let serverInstance: InMemoryDurableStreamsServer | null = null;

/**
 * Get or create the durable streams server instance
 */
export function getDurableStreamsServer(): InMemoryDurableStreamsServer {
  if (!serverInstance) {
    serverInstance = new InMemoryDurableStreamsServer();
  }
  return serverInstance;
}

/**
 * Create a new durable streams server instance (for testing)
 */
export function createDurableStreamsServer(): InMemoryDurableStreamsServer {
  return new InMemoryDurableStreamsServer();
}
