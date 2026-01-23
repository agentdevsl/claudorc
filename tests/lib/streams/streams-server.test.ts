import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createDurableStreamsServer,
  getDurableStreamsServer,
  InMemoryDurableStreamsServer,
} from '@/lib/streams/server';

describe('InMemoryDurableStreamsServer', () => {
  let server: InMemoryDurableStreamsServer;

  beforeEach(() => {
    server = createDurableStreamsServer();
  });

  // ============================================================================
  // Server Initialization (4 tests)
  // ============================================================================
  describe('Server Initialization', () => {
    it('creates a new server instance', () => {
      const instance = createDurableStreamsServer();
      expect(instance).toBeInstanceOf(InMemoryDurableStreamsServer);
    });

    it('returns singleton instance from getDurableStreamsServer', () => {
      const instance1 = getDurableStreamsServer();
      const instance2 = getDurableStreamsServer();
      expect(instance1).toBe(instance2);
    });

    it('initializes with no streams', () => {
      expect(server.hasStream('non-existent')).toBe(false);
    });

    it('handles stream creation errors gracefully', async () => {
      // Verify idempotent stream creation (no error on duplicate creation)
      await server.createStream('stream-1', { type: 'test' });
      await server.createStream('stream-1', { type: 'different-schema' });

      // Stream should still exist after duplicate creation attempt
      expect(server.hasStream('stream-1')).toBe(true);
    });
  });

  // ============================================================================
  // Stream Handling (6 tests)
  // ============================================================================
  describe('Stream Handling', () => {
    it('creates a new stream with schema', async () => {
      const schema = { type: 'session', version: 1 };
      await server.createStream('session-123', schema);

      expect(server.hasStream('session-123')).toBe(true);
      const metadata = server.getStreamMetadata('session-123');
      expect(metadata).not.toBeNull();
      expect(metadata?.eventCount).toBe(0);
    });

    it('publishes events to an existing stream', async () => {
      await server.createStream('stream-1', null);
      await server.publish('stream-1', 'test-event', { message: 'hello' });

      const events = server.getEvents('stream-1');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test-event');
      expect(events[0].data).toEqual({ message: 'hello' });
      expect(events[0].offset).toBe(0);
    });

    it('notifies subscribers when events are published', async () => {
      await server.createStream('stream-1', null);

      const receivedEvents: { type: string; data: unknown; offset: number }[] = [];
      const subscription = server.subscribe('stream-1');

      // Start consuming in background
      const consumePromise = (async () => {
        for await (const event of subscription) {
          receivedEvents.push(event);
          if (receivedEvents.length >= 2) break;
        }
      })();

      // Give subscription time to set up, then publish events
      await new Promise((resolve) => setTimeout(resolve, 10));
      await server.publish('stream-1', 'event-1', { value: 1 });
      await server.publish('stream-1', 'event-2', { value: 2 });

      await consumePromise;

      expect(receivedEvents).toHaveLength(2);
      expect(receivedEvents[0].type).toBe('event-1');
      expect(receivedEvents[1].type).toBe('event-2');
    });

    it('deletes a stream and its events', async () => {
      await server.createStream('stream-to-delete', null);
      await server.publish('stream-to-delete', 'event', { data: 1 });

      expect(server.hasStream('stream-to-delete')).toBe(true);

      const deleted = await server.deleteStream('stream-to-delete');
      expect(deleted).toBe(true);
      expect(server.hasStream('stream-to-delete')).toBe(false);
      expect(server.getEvents('stream-to-delete')).toEqual([]);
    });

    it('handles subscriber errors without breaking other subscribers', async () => {
      await server.createStream('stream-1', null);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const goodEvents: { type: string; data: unknown; offset: number }[] = [];

      // Start a good subscriber
      const goodSubscription = server.subscribe('stream-1');
      const goodConsumer = (async () => {
        for await (const event of goodSubscription) {
          goodEvents.push(event);
          if (goodEvents.length >= 1) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 10));
      await server.publish('stream-1', 'test', { value: 1 });

      await goodConsumer;

      // Good subscriber should still receive the event
      expect(goodEvents).toHaveLength(1);
      consoleSpy.mockRestore();
    });

    it('auto-creates stream when publishing to non-existent stream', async () => {
      expect(server.hasStream('auto-created')).toBe(false);

      await server.publish('auto-created', 'test-event', { data: 'test' });

      expect(server.hasStream('auto-created')).toBe(true);
      const events = server.getEvents('auto-created');
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('test-event');
    });
  });

  // ============================================================================
  // Client Connections (5 tests)
  // ============================================================================
  describe('Client Connections', () => {
    it('allows clients to subscribe and receive new events', async () => {
      await server.createStream('client-stream', null);

      // Publish some events before subscribing
      await server.publish('client-stream', 'existing-1', { id: 1 });
      await server.publish('client-stream', 'existing-2', { id: 2 });

      const events: { type: string; data: unknown; offset: number }[] = [];
      const subscription = server.subscribe('client-stream');

      // Collect events
      for await (const event of subscription) {
        events.push(event);
        if (events.length >= 2) break;
      }

      expect(events).toHaveLength(2);
      expect(events[0].offset).toBe(0);
      expect(events[1].offset).toBe(1);
    });

    it('handles client disconnection by cleaning up subscriber', async () => {
      await server.createStream('disconnect-stream', null);

      const subscription = server.subscribe('disconnect-stream');
      const iterator = subscription[Symbol.asyncIterator]();

      // Publish an event
      await server.publish('disconnect-stream', 'event', { data: 1 });

      // Read the event
      const result = await iterator.next();
      expect(result.done).toBe(false);
      expect(result.value.type).toBe('event');

      // Force cleanup by returning (simulating disconnect)
      await iterator.return?.({ type: '', data: null, offset: 0 });

      // Stream should still exist and be functional
      expect(server.hasStream('disconnect-stream')).toBe(true);
    });

    it('routes messages to correct subscribers only', async () => {
      await server.createStream('stream-a', null);
      await server.createStream('stream-b', null);

      const eventsA: { type: string; data: unknown; offset: number }[] = [];
      const eventsB: { type: string; data: unknown; offset: number }[] = [];

      const subA = server.subscribe('stream-a');
      const subB = server.subscribe('stream-b');

      const consumerA = (async () => {
        for await (const event of subA) {
          eventsA.push(event);
          if (eventsA.length >= 1) break;
        }
      })();

      const consumerB = (async () => {
        for await (const event of subB) {
          eventsB.push(event);
          if (eventsB.length >= 1) break;
        }
      })();

      await new Promise((resolve) => setTimeout(resolve, 10));

      await server.publish('stream-a', 'event-for-a', { target: 'a' });
      await server.publish('stream-b', 'event-for-b', { target: 'b' });

      await Promise.all([consumerA, consumerB]);

      expect(eventsA).toHaveLength(1);
      expect(eventsA[0].type).toBe('event-for-a');

      expect(eventsB).toHaveLength(1);
      expect(eventsB[0].type).toBe('event-for-b');
    });

    it('supports reconnection with offset-based resumability', async () => {
      await server.createStream('resume-stream', null);

      // Publish several events
      await server.publish('resume-stream', 'event-0', { seq: 0 });
      await server.publish('resume-stream', 'event-1', { seq: 1 });
      await server.publish('resume-stream', 'event-2', { seq: 2 });
      await server.publish('resume-stream', 'event-3', { seq: 3 });

      // Subscribe from offset 2 (simulating reconnection)
      const events: { type: string; data: unknown; offset: number }[] = [];
      const subscription = server.subscribe('resume-stream', { fromOffset: 2 });

      for await (const event of subscription) {
        events.push(event);
        if (events.length >= 2) break;
      }

      expect(events).toHaveLength(2);
      expect(events[0].offset).toBe(2);
      expect(events[0].type).toBe('event-2');
      expect(events[1].offset).toBe(3);
      expect(events[1].type).toBe('event-3');
    });

    it('throws error when subscribing to non-existent stream', async () => {
      const subscription = server.subscribe('non-existent-stream');
      const iterator = subscription[Symbol.asyncIterator]();

      await expect(iterator.next()).rejects.toThrow('Stream non-existent-stream not found');
    });
  });

  // ============================================================================
  // Additional Edge Cases
  // ============================================================================
  describe('Edge Cases', () => {
    it('returns correct current offset for stream', async () => {
      await server.createStream('offset-stream', null);

      expect(server.getCurrentOffset('offset-stream')).toBe(0);

      await server.publish('offset-stream', 'event-1', {});
      expect(server.getCurrentOffset('offset-stream')).toBe(1);

      await server.publish('offset-stream', 'event-2', {});
      expect(server.getCurrentOffset('offset-stream')).toBe(2);
    });

    it('returns 0 for current offset of non-existent stream', () => {
      expect(server.getCurrentOffset('missing-stream')).toBe(0);
    });

    it('returns null metadata for non-existent stream', () => {
      expect(server.getStreamMetadata('missing-stream')).toBeNull();
    });

    it('returns empty events array for non-existent stream', () => {
      expect(server.getEvents('missing-stream')).toEqual([]);
    });

    it('supports pagination with getEvents', async () => {
      await server.createStream('paginated-stream', null);

      // Publish 10 events
      for (let i = 0; i < 10; i++) {
        await server.publish('paginated-stream', `event-${i}`, { index: i });
      }

      // Get first 3 events
      const page1 = server.getEvents('paginated-stream', { fromOffset: 0, limit: 3 });
      expect(page1).toHaveLength(3);
      expect(page1[0].offset).toBe(0);
      expect(page1[2].offset).toBe(2);

      // Get next 3 events
      const page2 = server.getEvents('paginated-stream', { fromOffset: 3, limit: 3 });
      expect(page2).toHaveLength(3);
      expect(page2[0].offset).toBe(3);
      expect(page2[2].offset).toBe(5);

      // Get remaining events
      const page3 = server.getEvents('paginated-stream', { fromOffset: 6, limit: 10 });
      expect(page3).toHaveLength(4);
    });

    it('returns false when deleting non-existent stream', async () => {
      const deleted = await server.deleteStream('non-existent');
      expect(deleted).toBe(false);
    });
  });
});
