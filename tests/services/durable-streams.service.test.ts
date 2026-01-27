import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type DurableStreamsServer,
  DurableStreamsService,
  type PlanCompletedEvent,
  type PlanErrorEvent,
  type PlanInteractionEvent,
  type PlanStartedEvent,
  type PlanTokenEvent,
  type PlanTurnEvent,
  type SandboxCreatingEvent,
  type SandboxErrorEvent,
  type SandboxIdleEvent,
  type SandboxReadyEvent,
  type SandboxStoppedEvent,
  type SandboxStoppingEvent,
  type SandboxTmuxCreatedEvent,
  type SandboxTmuxDestroyedEvent,
  type StreamEvent,
  type TaskCreationCancelledEvent,
  type TaskCreationCompletedEvent,
  type TaskCreationErrorEvent,
  type TaskCreationMessageEvent,
  type TaskCreationStartedEvent,
  type TaskCreationSuggestionEvent,
  type TaskCreationTokenEvent,
} from '../../src/services/durable-streams.service';
import type { SessionEvent } from '../../src/services/session.service';

// =============================================================================
// Mock Server Factory
// =============================================================================

const createMockServer = (): DurableStreamsServer => ({
  createStream: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(1), // Returns offset
  subscribe: vi.fn(async function* () {
    yield { type: 'chunk', data: { content: 'test' } };
    yield { type: 'tool:start', data: { toolId: 'tool1' } };
  }),
  deleteStream: vi.fn().mockResolvedValue(true),
});

describe('DurableStreamsService', () => {
  let service: DurableStreamsService;
  let mockServer: ReturnType<typeof createMockServer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockServer = createMockServer();
    service = new DurableStreamsService(mockServer);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =============================================================================
  // Stream Creation and Management (4 tests)
  // =============================================================================

  describe('Stream Creation and Management', () => {
    it('creates a new stream with schema', async () => {
      const schema = { type: 'session', version: 1 };

      await service.createStream('stream-1', schema);

      expect(mockServer.createStream).toHaveBeenCalledWith('stream-1', schema);
      expect(mockServer.createStream).toHaveBeenCalledTimes(1);
    });

    it('initializes subscriber set when creating stream', async () => {
      await service.createStream('stream-2', {});

      // Test that subscriber set is initialized by adding a subscriber
      const callback = vi.fn();
      const unsubscribe = service.addSubscriber('stream-2', callback);

      // Publish an event - should call the callback
      await service.publish('stream-2', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(callback).toHaveBeenCalled();
      unsubscribe();
    });

    it('handles multiple streams independently', async () => {
      await service.createStream('stream-a', { id: 'a' });
      await service.createStream('stream-b', { id: 'b' });

      expect(mockServer.createStream).toHaveBeenCalledTimes(2);
      expect(mockServer.createStream).toHaveBeenNthCalledWith(1, 'stream-a', { id: 'a' });
      expect(mockServer.createStream).toHaveBeenNthCalledWith(2, 'stream-b', { id: 'b' });
    });

    it('returns the underlying server via getServer()', () => {
      const server = service.getServer();

      expect(server).toBe(mockServer);
    });

    it('removes subscribers when deleting a stream', async () => {
      await service.createStream('remove-stream', {});
      const callback = vi.fn();
      service.addSubscriber('remove-stream', callback);

      await service.deleteStream('remove-stream');

      await service.publish('remove-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Event Publishing (6 tests)
  // =============================================================================

  describe('Event Publishing', () => {
    it('publishes a generic event to a stream', async () => {
      await service.createStream('pub-stream', {});

      await service.publish('pub-stream', 'task-creation:token', {
        sessionId: 's1',
        delta: 'hello',
        accumulated: 'hello',
      });

      expect(mockServer.publish).toHaveBeenCalledWith('pub-stream', 'task-creation:token', {
        sessionId: 's1',
        delta: 'hello',
        accumulated: 'hello',
      });
    });

    it('notifies local subscribers when publishing', async () => {
      await service.createStream('notify-stream', {});
      const callback = vi.fn();
      service.addSubscriber('notify-stream', callback);

      await service.publish('notify-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0] as StreamEvent;
      expect(event.type).toBe('task-creation:started');
      expect(event.data).toEqual({ sessionId: 's1', projectId: 'p1' });
      expect(event.id).toBeDefined();
      expect(event.timestamp).toBeDefined();
    });

    it('returns the offset from publish', async () => {
      await service.createStream('offset-stream', {});

      mockServer.publish.mockResolvedValueOnce(42);
      const offset = await service.publish('offset-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(offset).toBe(42);
    });

    it('handles publishing to stream with no subscribers', async () => {
      await service.createStream('empty-stream', {});

      // Should not throw, returns offset
      const offset = await service.publish('empty-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });
      expect(offset).toBe(1); // Mock returns 1
      expect(mockServer.publish).toHaveBeenCalled();
    });

    it('notifies multiple subscribers for the same stream', async () => {
      await service.createStream('multi-sub-stream', {});
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const callback3 = vi.fn();

      service.addSubscriber('multi-sub-stream', callback1);
      service.addSubscriber('multi-sub-stream', callback2);
      service.addSubscriber('multi-sub-stream', callback3);

      await service.publish('multi-sub-stream', 'task-creation:completed', {
        sessionId: 's1',
        taskId: 't1',
        suggestion: { title: 'Test', description: 'Desc', labels: [], priority: 'medium' },
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });

    it('generates unique event IDs for each publish', async () => {
      await service.createStream('unique-id-stream', {});
      const events: StreamEvent[] = [];
      service.addSubscriber('unique-id-stream', (event) => events.push(event));

      await service.publish('unique-id-stream', 'task-creation:token', {
        sessionId: 's1',
        delta: '1',
        accumulated: '1',
      });
      await service.publish('unique-id-stream', 'task-creation:token', {
        sessionId: 's1',
        delta: '2',
        accumulated: '12',
      });
      await service.publish('unique-id-stream', 'task-creation:token', {
        sessionId: 's1',
        delta: '3',
        accumulated: '123',
      });

      expect(events).toHaveLength(3);
      const ids = events.map((e) => e.id);
      expect(new Set(ids).size).toBe(3); // All unique
    });

    it('includes timestamp in published events', async () => {
      await service.createStream('timestamp-stream', {});
      const events: StreamEvent[] = [];
      service.addSubscriber('timestamp-stream', (event) => events.push(event));

      const before = Date.now();
      await service.publish('timestamp-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });
      const after = Date.now();

      expect(events[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(events[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  // =============================================================================
  // Subscription Handling (5 tests)
  // =============================================================================

  describe('Subscription Handling', () => {
    it('adds a subscriber to an existing stream', async () => {
      await service.createStream('sub-stream', {});
      const callback = vi.fn();

      const unsubscribe = service.addSubscriber('sub-stream', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('adds a subscriber to a non-existent stream (creates subscriber set)', () => {
      const callback = vi.fn();

      // Should not throw even without createStream being called first
      const unsubscribe = service.addSubscriber('new-stream', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('removes subscriber when unsubscribe function is called', async () => {
      await service.createStream('unsub-stream', {});
      const callback = vi.fn();
      const unsubscribe = service.addSubscriber('unsub-stream', callback);

      // First publish - should call callback
      await service.publish('unsub-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });
      expect(callback).toHaveBeenCalledTimes(1);

      // Unsubscribe
      unsubscribe();

      // Second publish - should not call callback
      await service.publish('unsub-stream', 'task-creation:started', {
        sessionId: 's2',
        projectId: 'p2',
      });
      expect(callback).toHaveBeenCalledTimes(1); // Still 1
    });

    it('iterates over server subscription via subscribe()', async () => {
      const events: StreamEvent[] = [];

      for await (const event of service.subscribe('iter-stream')) {
        events.push(event);
        if (events.length >= 2) break;
      }

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('chunk');
      expect(events[1].type).toBe('tool:start');
      expect(mockServer.subscribe).toHaveBeenCalledWith('iter-stream');
    });

    it('transforms server events with id and timestamp in subscribe()', async () => {
      const events: StreamEvent[] = [];

      for await (const event of service.subscribe('transform-stream')) {
        events.push(event);
        if (events.length >= 1) break;
      }

      expect(events[0].id).toBeDefined();
      expect(typeof events[0].id).toBe('string');
      expect(events[0].timestamp).toBeDefined();
      expect(typeof events[0].timestamp).toBe('number');
    });
  });

  // =============================================================================
  // Error Handling (4 tests)
  // =============================================================================

  describe('Error Handling', () => {
    it('catches and logs subscriber callback errors without stopping other subscribers', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await service.createStream('error-stream', {});

      const throwingCallback = vi.fn(() => {
        throw new Error('Subscriber error');
      });
      const normalCallback = vi.fn();

      service.addSubscriber('error-stream', throwingCallback);
      service.addSubscriber('error-stream', normalCallback);

      await service.publish('error-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(throwingCallback).toHaveBeenCalled();
      expect(normalCallback).toHaveBeenCalled(); // Still called despite previous error
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DurableStreamsService] Subscriber error for error-stream:'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('calls async subscriber callbacks (errors not caught for async)', async () => {
      // Note: Async subscriber callbacks are called but not awaited.
      // This is by design - local subscribers are meant for synchronous in-process notifications.
      // Async errors will result in unhandled promise rejections.
      await service.createStream('async-stream', {});

      const asyncCallback = vi.fn(async () => {
        // Async callback that completes successfully
        return 'done';
      });

      service.addSubscriber('async-stream', asyncCallback);

      await service.publish('async-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(asyncCallback).toHaveBeenCalled();
    });

    it('handles server publish failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingServer = {
        ...createMockServer(),
        publish: vi.fn().mockRejectedValue(new Error('Server publish failed')),
      };
      const failingService = new DurableStreamsService(failingServer);

      await expect(
        failingService.publish('stream', 'task-creation:started', {
          sessionId: 's1',
          projectId: 'p1',
        })
      ).rejects.toThrow('Server publish failed');

      consoleSpy.mockRestore();
    });

    it('handles server createStream failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const failingServer = {
        ...createMockServer(),
        createStream: vi.fn().mockRejectedValue(new Error('Create stream failed')),
      };
      const failingService = new DurableStreamsService(failingServer);

      await expect(failingService.createStream('stream', {})).rejects.toThrow(
        'Create stream failed'
      );

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Input Validation (4 tests)
  // =============================================================================

  describe('Input Validation', () => {
    it('throws error when createStream is called with empty id', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.createStream('', {})).rejects.toThrow('streamId is required');

      consoleSpy.mockRestore();
    });

    it('throws error when publish is called with empty streamId', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(
        service.publish('', 'task-creation:started', { sessionId: 's1', projectId: 'p1' })
      ).rejects.toThrow('streamId is required');

      consoleSpy.mockRestore();
    });

    it('throws error when subscribe is called with empty streamId', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const iterator = service.subscribe('')[Symbol.asyncIterator]();
      await expect(iterator.next()).rejects.toThrow('streamId is required');

      consoleSpy.mockRestore();
    });

    it('throws error when createStream is called with whitespace-only id', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await expect(service.createStream('   ', {})).rejects.toThrow('streamId is required');

      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Session Event Helpers (1 test)
  // =============================================================================

  describe('Session Event Helpers', () => {
    it('publishes session events and notifies local subscribers', async () => {
      await service.createStream('session-stream', {});
      const callback = vi.fn();
      service.addSubscriber('session-stream', callback);

      const event: SessionEvent = {
        id: 'evt-1',
        type: 'chunk',
        timestamp: 1234,
        data: { content: 'hello' },
      };

      await service.publishSessionEvent('session-stream', event);

      expect(mockServer.publish).toHaveBeenCalledWith('session-stream', 'chunk', {
        content: 'hello',
      });
      const notified = callback.mock.calls[0][0] as StreamEvent;
      expect(notified.id).toBe('evt-1');
      expect(notified.timestamp).toBe(1234);
    });
  });

  // =============================================================================
  // Plan Mode Events (6 tests)
  // =============================================================================

  describe('Plan Mode Events', () => {
    const streamId = 'plan-stream';

    beforeEach(async () => {
      await service.createStream(streamId, {});
    });

    it('publishes plan:started event', async () => {
      const data: PlanStartedEvent = {
        sessionId: 's1',
        taskId: 't1',
        projectId: 'p1',
      };

      await service.publish(streamId, 'plan:started', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:started', data);
    });

    it('publishes plan:turn event', async () => {
      const data: PlanTurnEvent = {
        sessionId: 's1',
        turnId: 'turn1',
        role: 'assistant',
        content: 'Hello, how can I help?',
      };

      await service.publish(streamId, 'plan:turn', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:turn', data);
    });

    it('publishes plan:token event', async () => {
      const data: PlanTokenEvent = {
        sessionId: 's1',
        delta: 'world',
        accumulated: 'Hello world',
      };

      await service.publish(streamId, 'plan:token', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:token', data);
    });

    it('publishes plan:interaction event', async () => {
      const data: PlanInteractionEvent = {
        sessionId: 's1',
        interactionId: 'i1',
        questions: [
          {
            question: 'Which approach?',
            header: 'Implementation Options',
            options: [
              { label: 'Option A', description: 'Fast approach' },
              { label: 'Option B', description: 'Safe approach' },
            ],
            multiSelect: false,
          },
        ],
      };

      await service.publish(streamId, 'plan:interaction', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:interaction', data);
    });

    it('publishes plan:completed event', async () => {
      const data: PlanCompletedEvent = {
        sessionId: 's1',
        issueUrl: 'https://github.com/org/repo/issues/42',
        issueNumber: 42,
      };

      await service.publish(streamId, 'plan:completed', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:completed', data);
    });

    it('publishes plan:error event', async () => {
      const data: PlanErrorEvent = {
        sessionId: 's1',
        error: 'Something went wrong',
        code: 'PLAN_FAILED',
      };

      await service.publish(streamId, 'plan:error', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'plan:error', data);
    });
  });

  // =============================================================================
  // Sandbox Events (8 tests)
  // =============================================================================

  describe('Sandbox Events', () => {
    const streamId = 'sandbox-stream';

    beforeEach(async () => {
      await service.createStream(streamId, {});
    });

    it('publishes sandbox:creating event', async () => {
      const data: SandboxCreatingEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
        image: 'node:18-alpine',
      };

      await service.publish(streamId, 'sandbox:creating', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:creating', data);
    });

    it('publishes sandbox:ready event', async () => {
      const data: SandboxReadyEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
        containerId: 'container-abc123',
      };

      await service.publish(streamId, 'sandbox:ready', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:ready', data);
    });

    it('publishes sandbox:idle event', async () => {
      const data: SandboxIdleEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
        idleSince: Date.now() - 60000,
        timeoutMinutes: 30,
      };

      await service.publish(streamId, 'sandbox:idle', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:idle', data);
    });

    it('publishes sandbox:stopping event', async () => {
      const data: SandboxStoppingEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
        reason: 'idle_timeout',
      };

      await service.publish(streamId, 'sandbox:stopping', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:stopping', data);
    });

    it('publishes sandbox:stopped event', async () => {
      const data: SandboxStoppedEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
      };

      await service.publish(streamId, 'sandbox:stopped', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:stopped', data);
    });

    it('publishes sandbox:error event', async () => {
      const data: SandboxErrorEvent = {
        sandboxId: 'sb1',
        projectId: 'p1',
        error: 'Container failed to start',
        code: 'CONTAINER_START_FAILED',
      };

      await service.publish(streamId, 'sandbox:error', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:error', data);
    });

    it('publishes sandbox:tmux:created event', async () => {
      const data: SandboxTmuxCreatedEvent = {
        sandboxId: 'sb1',
        sessionName: 'task-session',
        taskId: 't1',
      };

      await service.publish(streamId, 'sandbox:tmux:created', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:tmux:created', data);
    });

    it('publishes sandbox:tmux:destroyed event', async () => {
      const data: SandboxTmuxDestroyedEvent = {
        sandboxId: 'sb1',
        sessionName: 'task-session',
      };

      await service.publish(streamId, 'sandbox:tmux:destroyed', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'sandbox:tmux:destroyed', data);
    });
  });

  // =============================================================================
  // Task Creation Events (7 tests)
  // =============================================================================

  describe('Task Creation Events', () => {
    const streamId = 'task-creation-stream';

    beforeEach(async () => {
      await service.createStream(streamId, {});
    });

    it('publishes task-creation:started event', async () => {
      const data: TaskCreationStartedEvent = {
        sessionId: 's1',
        projectId: 'p1',
      };

      await service.publish(streamId, 'task-creation:started', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:started', data);
    });

    it('publishes task-creation:message event', async () => {
      const data: TaskCreationMessageEvent = {
        sessionId: 's1',
        messageId: 'm1',
        role: 'user',
        content: 'I want to add a new feature',
      };

      await service.publish(streamId, 'task-creation:message', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:message', data);
    });

    it('publishes task-creation:token event', async () => {
      const data: TaskCreationTokenEvent = {
        sessionId: 's1',
        delta: ' feature',
        accumulated: 'Add new feature',
      };

      await service.publish(streamId, 'task-creation:token', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:token', data);
    });

    it('publishes task-creation:suggestion event', async () => {
      const data: TaskCreationSuggestionEvent = {
        sessionId: 's1',
        suggestion: {
          title: 'Add user authentication',
          description: 'Implement OAuth2 login flow',
          labels: ['feature', 'auth'],
          priority: 'high',
        },
      };

      await service.publish(streamId, 'task-creation:suggestion', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:suggestion', data);
    });

    it('publishes task-creation:completed event', async () => {
      const data: TaskCreationCompletedEvent = {
        sessionId: 's1',
        taskId: 't1',
        suggestion: {
          title: 'Add user authentication',
          description: 'Implement OAuth2 login flow',
          labels: ['feature', 'auth'],
          priority: 'high',
        },
      };

      await service.publish(streamId, 'task-creation:completed', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:completed', data);
    });

    it('publishes task-creation:cancelled event', async () => {
      const data: TaskCreationCancelledEvent = {
        sessionId: 's1',
      };

      await service.publish(streamId, 'task-creation:cancelled', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:cancelled', data);
    });

    it('publishes task-creation:error event', async () => {
      const data: TaskCreationErrorEvent = {
        sessionId: 's1',
        error: 'Failed to generate task suggestion',
        code: 'AI_GENERATION_FAILED',
      };

      await service.publish(streamId, 'task-creation:error', data);

      expect(mockServer.publish).toHaveBeenCalledWith(streamId, 'task-creation:error', data);
    });
  });

  // =============================================================================
  // Delete Stream (2 tests)
  // =============================================================================

  describe('Delete Stream', () => {
    it('calls server deleteStream when available', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await service.createStream('del-stream', {});

      await service.deleteStream('del-stream');

      expect(mockServer.deleteStream).toHaveBeenCalledWith('del-stream');
      consoleSpy.mockRestore();
    });

    it('cleans up local subscribers when deleting', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await service.createStream('cleanup-stream', {});
      const callback = vi.fn();
      service.addSubscriber('cleanup-stream', callback);

      await service.deleteStream('cleanup-stream');

      // Publish after delete - callback should not be called
      await service.publish('cleanup-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });
      expect(callback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // =============================================================================
  // Edge Cases (2 tests)
  // =============================================================================

  describe('Edge Cases', () => {
    it('handles publishing to stream without prior createStream call', async () => {
      // This tests that notifySubscribers handles streams that were never initialized
      // No subscribers should exist, so notifySubscribers should be a no-op
      await service.publish('non-existent-stream', 'task-creation:started', {
        sessionId: 's1',
        projectId: 'p1',
      });

      expect(mockServer.publish).toHaveBeenCalledWith(
        'non-existent-stream',
        'task-creation:started',
        {
          sessionId: 's1',
          projectId: 'p1',
        }
      );
    });

    it('handles empty data in task creation events', async () => {
      await service.createStream('empty-data-stream', {});
      const callback = vi.fn();
      service.addSubscriber('empty-data-stream', callback);

      await service.publish('empty-data-stream', 'task-creation:cancelled', { sessionId: 's1' });

      expect(callback).toHaveBeenCalled();
      const event = callback.mock.calls[0][0] as StreamEvent;
      expect(event.data).toEqual({ sessionId: 's1' });
    });
  });
});
