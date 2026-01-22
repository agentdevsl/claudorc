import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTaskCreation } from '@/app/components/features/new-task-dialog/use-task-creation';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    taskCreation: {
      start: vi.fn(),
      sendMessage: vi.fn(),
      accept: vi.fn(),
      cancel: vi.fn(),
      getStreamUrl: vi.fn(
        (sessionId: string) => `/api/tasks/create-with-ai/stream?sessionId=${sessionId}`
      ),
    },
  },
}));

import { apiClient } from '@/lib/api/client';

// Mock EventSource
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 1; // OPEN

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 0);
  }

  close() {
    this.readyState = 2; // CLOSED
  }

  // Helper to simulate server messages
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
    }
  }

  simulateError() {
    if (this.onerror) {
      this.onerror(new Event('error'));
    }
  }
}

// Replace global EventSource
const originalEventSource = global.EventSource;

describe('useTaskCreation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockEventSource.instances = [];
    // @ts-expect-error - Mocking EventSource
    global.EventSource = MockEventSource;
  });

  afterEach(() => {
    global.EventSource = originalEventSource;
  });

  describe('initial state', () => {
    it('has idle status initially', () => {
      const { result } = renderHook(() => useTaskCreation('project-1'));

      expect(result.current.status).toBe('idle');
      expect(result.current.sessionId).toBeNull();
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.streamingContent).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.suggestion).toBeNull();
      expect(result.current.createdTaskId).toBeNull();
      expect(result.current.error).toBeNull();
    });
  });

  describe('startConversation', () => {
    it('creates a session and connects to stream', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      expect(result.current.status).toBe('active');
      expect(result.current.sessionId).toBe('session-1');
      expect(apiClient.taskCreation.start).toHaveBeenCalledWith('project-1');
    });

    it('sets error status on failure', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: false,
        error: { code: 'ERROR', message: 'Failed to start' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Failed to start');
    });
  });

  describe('sendMessage', () => {
    it('sends message and adds to list', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });
      vi.mocked(apiClient.taskCreation.sendMessage).mockResolvedValue({
        ok: true,
        data: { messageId: 'msg-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await act(async () => {
        await result.current.sendMessage('Create a bug fix task');
      });

      // User message should be added immediately
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.role).toBe('user');
      expect(result.current.messages[0]?.content).toBe('Create a bug fix task');
      expect(result.current.isStreaming).toBe(true);
    });

    it('sets error when no session', async () => {
      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.sendMessage('hello');
      });

      expect(result.current.error).toBe('No active session. Please start a conversation first.');
    });
  });

  describe('SSE events', () => {
    it('handles token events for streaming', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      // Wait for EventSource connection
      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();

      // Simulate token streaming
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:token',
          data: { delta: 'Hello', accumulated: 'Hello' },
        });
      });

      expect(result.current.streamingContent).toBe('Hello');
      expect(result.current.isStreaming).toBe(true);

      // More tokens
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:token',
          data: { delta: ' world', accumulated: 'Hello world' },
        });
      });

      expect(result.current.streamingContent).toBe('Hello world');
    });

    it('handles message completion', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();

      // Simulate assistant message completion
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:message',
          data: {
            messageId: 'msg-1',
            role: 'assistant',
            content: 'Here is my response',
          },
        });
      });

      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.role).toBe('assistant');
      expect(result.current.messages[0]?.content).toBe('Here is my response');
      expect(result.current.streamingContent).toBe('');
      expect(result.current.isStreaming).toBe(false);
    });

    it('handles suggestion event', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();

      // Simulate suggestion
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:suggestion',
          data: {
            suggestion: {
              title: 'Fix bug',
              description: 'Fix the login bug',
              labels: ['bug'],
              priority: 'high',
              mode: 'implement',
            },
          },
        });
      });

      expect(result.current.suggestion).not.toBeNull();
      expect(result.current.suggestion?.title).toBe('Fix bug');
      expect(result.current.suggestion?.priority).toBe('high');
    });

    it('handles error event', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();

      // Simulate error
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:error',
          data: { error: 'Something went wrong' },
        });
      });

      expect(result.current.status).toBe('error');
      expect(result.current.error).toBe('Something went wrong');
      expect(result.current.isStreaming).toBe(false);
    });

    it('handles completion event', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();

      // Simulate completion
      await act(async () => {
        eventSource.simulateMessage({
          type: 'task-creation:completed',
          data: { taskId: 'task-123' },
        });
      });

      expect(result.current.status).toBe('completed');
      expect(result.current.createdTaskId).toBe('task-123');
    });
  });

  describe('acceptSuggestion', () => {
    it('accepts suggestion and creates task', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });
      vi.mocked(apiClient.taskCreation.accept).mockResolvedValue({
        ok: true,
        data: { taskId: 'task-123', sessionId: 'session-1', status: 'completed' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      // Simulate suggestion via SSE
      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      await act(async () => {
        MockEventSource.instances[0]?.simulateMessage({
          type: 'task-creation:suggestion',
          data: {
            suggestion: {
              title: 'Test task',
              description: 'Description',
              labels: [],
              priority: 'medium',
              mode: 'implement',
            },
          },
        });
      });

      expect(result.current.suggestion).not.toBeNull();

      await act(async () => {
        await result.current.acceptSuggestion();
      });

      expect(apiClient.taskCreation.accept).toHaveBeenCalledWith('session-1', undefined);
      expect(result.current.createdTaskId).toBe('task-123');
      expect(result.current.status).toBe('completed');
    });

    it('accepts suggestion with overrides', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });
      vi.mocked(apiClient.taskCreation.accept).mockResolvedValue({
        ok: true,
        data: { taskId: 'task-123', sessionId: 'session-1', status: 'completed' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      await act(async () => {
        MockEventSource.instances[0]?.simulateMessage({
          type: 'task-creation:suggestion',
          data: {
            suggestion: {
              title: 'Original',
              description: 'Description',
              labels: [],
              priority: 'medium',
              mode: 'implement',
            },
          },
        });
      });

      await act(async () => {
        await result.current.acceptSuggestion({ title: 'Modified title' });
      });

      expect(apiClient.taskCreation.accept).toHaveBeenCalledWith('session-1', {
        title: 'Modified title',
      });
    });

    it('sets error when no suggestion', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await act(async () => {
        await result.current.acceptSuggestion();
      });

      expect(result.current.error).toBe('No suggestion available to accept.');
    });
  });

  describe('cancel', () => {
    it('cancels session', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });
      vi.mocked(apiClient.taskCreation.cancel).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1', status: 'cancelled' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await act(async () => {
        await result.current.cancel();
      });

      expect(apiClient.taskCreation.cancel).toHaveBeenCalledWith('session-1');
      expect(result.current.status).toBe('cancelled');
    });
  });

  describe('reset', () => {
    it('resets all state', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      expect(result.current.sessionId).toBe('session-1');
      expect(result.current.status).toBe('active');

      act(() => {
        result.current.reset();
      });

      expect(result.current.sessionId).toBeNull();
      expect(result.current.status).toBe('idle');
      expect(result.current.messages).toHaveLength(0);
      expect(result.current.streamingContent).toBe('');
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.suggestion).toBeNull();
      expect(result.current.createdTaskId).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('closes EventSource on reset', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();
      expect(eventSource.readyState).toBe(1); // OPEN

      act(() => {
        result.current.reset();
      });

      expect(eventSource.readyState).toBe(2); // CLOSED
    });
  });

  describe('unmount cleanup', () => {
    it('closes EventSource on unmount', async () => {
      vi.mocked(apiClient.taskCreation.start).mockResolvedValue({
        ok: true,
        data: { sessionId: 'session-1' },
      });

      const { result, unmount } = renderHook(() => useTaskCreation('project-1'));

      await act(async () => {
        await result.current.startConversation();
      });

      await waitFor(() => {
        expect(MockEventSource.instances.length).toBe(1);
      });

      const eventSource = MockEventSource.instances[0];
      expect(eventSource).toBeDefined();
      expect(eventSource.readyState).toBe(1); // OPEN

      unmount();

      expect(eventSource.readyState).toBe(2); // CLOSED
    });
  });
});
