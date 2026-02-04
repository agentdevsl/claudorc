import type { SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tasks } from '../../src/db/schema';
import type { DurableStreamsService } from '../../src/services/durable-streams.service';
import type { SessionService } from '../../src/services/session.service';
import {
  TaskCreationService,
  type TaskCreationSession,
  type TaskSuggestion,
} from '../../src/services/task-creation.service';
import { createTestProject } from '../factories/project.factory';
import { clearTestDatabase, getTestDb, setupTestDatabase } from '../helpers/database';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  unstable_v2_createSession: vi.fn(),
}));

describe('TaskCreationService', () => {
  let service: TaskCreationService;
  let mockStreams: DurableStreamsService;
  let mockSessionService: SessionService;
  let mockV2Session: {
    send: ReturnType<typeof vi.fn>;
    stream: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };

  // Helper to create a mock async generator for streaming
  function createMockStream(messages: SDKMessage[]): AsyncGenerator<SDKMessage> {
    return (async function* () {
      for (const msg of messages) {
        yield msg;
      }
    })();
  }

  // Helper to create a valid task suggestion JSON response
  function createSuggestionResponse(suggestion: Partial<TaskSuggestion> = {}): string {
    const fullSuggestion = {
      type: 'task_suggestion',
      title: suggestion.title ?? 'Test Task Title',
      description: suggestion.description ?? 'Test task description with details.',
      labels: suggestion.labels ?? ['feature'],
      priority: suggestion.priority ?? 'medium',
    };
    return `Here's a task suggestion:\n\n\`\`\`json\n${JSON.stringify(fullSuggestion, null, 2)}\n\`\`\``;
  }

  beforeEach(async () => {
    // Clear mocks at the start to ensure clean state from previous tests
    vi.clearAllMocks();

    await setupTestDatabase();
    const db = getTestDb();

    // Create mock V2 session
    mockV2Session = {
      send: vi.fn().mockResolvedValue(undefined),
      stream: vi.fn(),
      close: vi.fn(),
    };

    // Mock unstable_v2_createSession to return our mock session
    const { unstable_v2_createSession } = await import('@anthropic-ai/claude-agent-sdk');
    (unstable_v2_createSession as ReturnType<typeof vi.fn>).mockReturnValue(mockV2Session);

    // Create mock streams service
    mockStreams = {
      createStream: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationStarted: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationMessage: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationToken: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationSuggestion: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationCompleted: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationCancelled: vi.fn().mockResolvedValue(undefined),
      publishTaskCreationError: vi.fn().mockResolvedValue(undefined),
    } as unknown as DurableStreamsService;

    // Create mock session service
    mockSessionService = {
      create: vi.fn().mockResolvedValue({ ok: true, value: { id: 'mock-db-session-id' } }),
      publish: vi.fn().mockResolvedValue({ ok: true }),
      close: vi.fn().mockResolvedValue({ ok: true }),
    } as unknown as SessionService;

    service = new TaskCreationService(db, mockStreams, mockSessionService);
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // =============================================================================
  // Conversation Start (4 tests)
  // =============================================================================

  describe('startConversation', () => {
    it('creates a new task creation session for valid project', async () => {
      const project = await createTestProject();

      const result = await service.startConversation(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.projectId).toBe(project.id);
        expect(result.value.status).toBe('active');
        expect(result.value.messages).toHaveLength(0);
        expect(result.value.suggestion).toBeNull();
        expect(result.value.createdTaskId).toBeNull();
        expect(result.value.createdAt).toBeDefined();
        expect(result.value.systemPromptSent).toBe(false);
      }
    });

    it('returns error for non-existent project', async () => {
      const result = await service.startConversation('non-existent-project-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('creates a stream for real-time events', async () => {
      const project = await createTestProject();

      await service.startConversation(project.id);

      expect(mockStreams.createStream).toHaveBeenCalled();
      expect(mockStreams.publishTaskCreationStarted).toHaveBeenCalled();
    });

    it('creates a database session for history tracking when session service available', async () => {
      const project = await createTestProject();

      const result = await service.startConversation(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dbSessionId).toBe('mock-db-session-id');
      }
      expect(mockSessionService.create).toHaveBeenCalledWith({
        projectId: project.id,
        title: 'Task Creation',
      });
    });
  });

  // =============================================================================
  // Send Message (6 tests)
  // =============================================================================

  describe('sendMessage', () => {
    it('adds user message to session', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      // Mock stream with assistant response
      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Create a login feature');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.messages[0].role).toBe('user');
        expect(result.value.messages[0].content).toBe('Create a login feature');
      }
    });

    it('processes assistant response and extracts suggestion', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;
      const suggestionResponse = createSuggestionResponse({
        title: 'Implement Login Feature',
        description: 'Add user authentication with email and password.',
        labels: ['feature', 'enhancement'],
        priority: 'high',
      });

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: suggestionResponse }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Create a login feature');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).not.toBeNull();
        expect(result.value.suggestion?.title).toBe('Implement Login Feature');
        expect(result.value.suggestion?.priority).toBe('high');
        expect(result.value.suggestion?.labels).toContain('enhancement');
      }
    });

    it('returns error for non-existent session', async () => {
      const result = await service.sendMessage('non-existent-session', 'Hello');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_NOT_FOUND');
      }
    });

    it('returns error for completed session', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      // Mock stream for first message
      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Create a task');
      await service.acceptSuggestion(sessionId);

      const result = await service.sendMessage(sessionId, 'Another message');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_COMPLETED');
      }
    });

    it('includes system prompt in first message only', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'First message');

      // Check that system prompt was included
      expect(mockV2Session.send).toHaveBeenCalledWith(
        expect.stringContaining('You are an AI assistant helping users')
      );

      // Reset mock for second message
      mockV2Session.send.mockClear();
      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Second message');

      // Second message should NOT include system prompt
      expect(mockV2Session.send).toHaveBeenCalledWith('Second message');
    });

    it('invokes token callback during streaming', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;
      const tokens: string[] = [];

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: 'Hello' },
            },
          } as unknown as SDKMessage,
          {
            type: 'stream_event',
            event: {
              type: 'content_block_delta',
              delta: { type: 'text_delta', text: ' world' },
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Test', (delta) => {
        tokens.push(delta);
      });

      expect(tokens).toContain('Hello');
      expect(tokens).toContain(' world');
    });
  });

  // =============================================================================
  // Accept Suggestion (4 tests)
  // =============================================================================

  describe('acceptSuggestion', () => {
    it('creates a task from the suggestion', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: createSuggestionResponse({
                    title: 'New Feature Task',
                    description: 'Implement the new feature',
                    labels: ['feature'],
                    priority: 'medium',
                  }),
                },
              ],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Create a new feature');

      const result = await service.acceptSuggestion(sessionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taskId).toBeDefined();
        expect(result.value.session.status).toBe('completed');
        expect(result.value.session.createdTaskId).toBe(result.value.taskId);

        // Verify task was created in database
        const db = getTestDb();
        const [task] = await db.select().from(tasks).where(eq(tasks.id, result.value.taskId));
        expect(task).toBeDefined();
        expect(task.title).toBe('New Feature Task');
        expect(task.column).toBe('backlog');
      }
    });

    it('allows overriding suggestion fields', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: createSuggestionResponse({
                    title: 'Original Title',
                    priority: 'low',
                  }),
                },
              ],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Create a task');

      const result = await service.acceptSuggestion(sessionId, {
        title: 'Overridden Title',
        priority: 'high',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const db = getTestDb();
        const [task] = await db.select().from(tasks).where(eq(tasks.id, result.value.taskId));
        expect(task.title).toBe('Overridden Title');
        expect(task.priority).toBe('high');
      }
    });

    it('returns error when no suggestion available', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      const result = await service.acceptSuggestion(sessionId);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NO_SUGGESTION');
      }
    });

    it('closes the V2 session and database session on accept', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const sendResult = await service.sendMessage(sessionId, 'Create a task');
      expect(sendResult.ok).toBe(true);

      const acceptResult = await service.acceptSuggestion(sessionId);
      expect(acceptResult.ok).toBe(true);
      if (!acceptResult.ok) return;

      expect(mockV2Session.close).toHaveBeenCalled();
      expect(mockSessionService.close).toHaveBeenCalledWith('mock-db-session-id');
    });
  });

  // =============================================================================
  // Cancel Session (3 tests)
  // =============================================================================

  describe('cancel', () => {
    it('cancels an active session', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      const result = await service.cancel(sessionId);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('cancelled');
        expect(result.value.completedAt).toBeDefined();
      }
    });

    it('returns error for non-existent session', async () => {
      const result = await service.cancel('non-existent-session');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_NOT_FOUND');
      }
    });

    it('closes V2 session and database session on cancel', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      await service.cancel(sessionId);

      expect(mockV2Session.close).toHaveBeenCalled();
      expect(mockSessionService.close).toHaveBeenCalledWith('mock-db-session-id');
      expect(mockStreams.publishTaskCreationCancelled).toHaveBeenCalled();
    });
  });

  // =============================================================================
  // Get Session (2 tests)
  // =============================================================================

  describe('getSession', () => {
    it('returns session by ID', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      const session = service.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(sessionId);
      expect(session?.projectId).toBe(project.id);
    });

    it('returns null for non-existent session', () => {
      const session = service.getSession('non-existent-session');

      expect(session).toBeNull();
    });
  });

  // =============================================================================
  // Suggestion Parsing (4 tests)
  // =============================================================================

  describe('suggestion parsing', () => {
    it('parses valid JSON suggestion from response', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: createSuggestionResponse({
                    title: 'Parsed Task',
                    description: 'This should be parsed correctly',
                    labels: ['bug', 'refactor'],
                    priority: 'high',
                  }),
                },
              ],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Create a bug fix');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion?.title).toBe('Parsed Task');
        expect(result.value.suggestion?.labels).toEqual(['bug', 'refactor']);
      }
    });

    it('handles response without JSON block', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: 'I understand. Let me help you with that.' }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Hello');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).toBeNull();
      }
    });

    it('handles malformed JSON in response', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: '```json\n{ invalid json }\n```',
                },
              ],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).toBeNull();
      }
    });

    it('validates priority field defaults to medium', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      const invalidPriorityJson = JSON.stringify({
        type: 'task_suggestion',
        title: 'Test Task',
        description: 'Description',
        labels: [],
        priority: 'invalid-priority',
      });

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: `\`\`\`json\n${invalidPriorityJson}\n\`\`\`` }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const result = await service.sendMessage(sessionId, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion?.priority).toBe('medium');
      }
    });
  });

  // =============================================================================
  // Error Handling (3 tests)
  // =============================================================================

  describe('error handling', () => {
    it('handles API errors during message send', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.send.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await service.sendMessage(sessionId, 'Create a task');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('API rate limit exceeded');
      }
    });

    it('publishes error event on API failure', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.send.mockRejectedValue(new Error('Network error'));

      await service.sendMessage(sessionId, 'Create a task');

      expect(mockStreams.publishTaskCreationError).toHaveBeenCalledWith(sessionId, {
        sessionId,
        error: 'Network error',
      });
    });

    it('returns error when V2 session is missing', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      // Manually remove the V2 session
      const session = service.getSession(sessionId) as TaskCreationSession;
      session.v2Session = null;

      const result = await service.sendMessage(sessionId, 'Create a task');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('No active V2 session');
      }
    });
  });

  // =============================================================================
  // Stream Event Publishing (2 tests)
  // =============================================================================

  describe('stream event publishing', () => {
    it('publishes message events for user and assistant', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Create a task');

      // Should publish user message
      expect(mockStreams.publishTaskCreationMessage).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          sessionId,
          role: 'user',
          content: 'Create a task',
        })
      );

      // Should publish assistant message
      expect(mockStreams.publishTaskCreationMessage).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          sessionId,
          role: 'assistant',
        })
      );
    });

    it('publishes suggestion event when suggestion is parsed', async () => {
      const project = await createTestProject();
      const startResult = await service.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [
                {
                  type: 'text',
                  text: createSuggestionResponse({
                    title: 'Published Suggestion',
                  }),
                },
              ],
            },
          } as unknown as SDKMessage,
        ])
      );

      await service.sendMessage(sessionId, 'Create a task');

      expect(mockStreams.publishTaskCreationSuggestion).toHaveBeenCalledWith(
        sessionId,
        expect.objectContaining({
          sessionId,
          suggestion: expect.objectContaining({
            title: 'Published Suggestion',
          }),
        })
      );
    });
  });

  // =============================================================================
  // Service Without Session Service (2 tests)
  // =============================================================================

  describe('service without session service', () => {
    it('works without session service', async () => {
      const db = getTestDb();
      const serviceWithoutSessionService = new TaskCreationService(db, mockStreams);

      const project = await createTestProject();
      const result = await serviceWithoutSessionService.startConversation(project.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.dbSessionId).toBeNull();
      }
    });

    it('skips database session operations when session service unavailable', async () => {
      const db = getTestDb();
      const serviceWithoutSessionService = new TaskCreationService(db, mockStreams);

      const project = await createTestProject();
      const startResult = await serviceWithoutSessionService.startConversation(project.id);
      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const sessionId = startResult.value.id;

      mockV2Session.stream.mockReturnValue(
        createMockStream([
          {
            type: 'assistant',
            message: {
              content: [{ type: 'text', text: createSuggestionResponse() }],
            },
          } as unknown as SDKMessage,
        ])
      );

      const sendResult = await serviceWithoutSessionService.sendMessage(sessionId, 'Test');
      expect(sendResult.ok).toBe(true);

      // Should not throw even without session service
      const cancelResult = await serviceWithoutSessionService.cancel(sessionId);
      expect(cancelResult.ok).toBe(true);
    });
  });
});
