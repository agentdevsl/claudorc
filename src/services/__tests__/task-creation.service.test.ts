import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TASK_CREATION_TOOLS } from '../../lib/constants/tools.js';
import {
  TaskCreationErrors,
  TaskCreationService,
  type TaskSuggestion,
} from '../task-creation.service.js';

// Mock the Claude Agent SDK
vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  unstable_v2_createSession: vi.fn(),
}));

import { unstable_v2_createSession } from '@anthropic-ai/claude-agent-sdk';

const createDbMock = () => ({
  query: {
    projects: { findFirst: vi.fn() },
    tasks: { findFirst: vi.fn(), findMany: vi.fn() },
  },
  insert: vi.fn(() => ({ values: vi.fn(() => ({ returning: vi.fn() })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => ({ returning: vi.fn() })) })) })),
  delete: vi.fn(() => ({ where: vi.fn() })),
});

const createStreamsMock = () => ({
  createStream: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationStarted: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationMessage: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationToken: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationSuggestion: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationCompleted: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationCancelled: vi.fn().mockResolvedValue(undefined),
  publishTaskCreationError: vi.fn().mockResolvedValue(undefined),
});

const createV2SessionMock = () => ({
  send: vi.fn().mockResolvedValue(undefined),
  stream: vi.fn(),
  close: vi.fn(),
});

describe('TaskCreationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startConversation', () => {
    it('creates a new session when project exists', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1', name: 'Test Project' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const service = new TaskCreationService(db as never, streams as never);
      const result = await service.startConversation('p1');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBeDefined();
        expect(result.value.projectId).toBe('p1');
        expect(result.value.status).toBe('active');
        expect(result.value.messages).toHaveLength(0);
        expect(result.value.suggestion).toBeNull();
        expect(result.value.v2Session).toBe(v2Session);
        expect(result.value.systemPromptSent).toBe(false);
      }

      expect(unstable_v2_createSession).toHaveBeenCalledWith({
        model: 'claude-sonnet-4-20250514',
        env: expect.objectContaining({ CLAUDE_CODE_ENABLE_TASKS: 'true' }),
        allowedTools: DEFAULT_TASK_CREATION_TOOLS,
      });
      expect(streams.createStream).toHaveBeenCalled();
      expect(streams.publishTaskCreationStarted).toHaveBeenCalled();
    });

    it('returns error when project not found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();

      db.query.projects.findFirst.mockResolvedValue(null);

      const service = new TaskCreationService(db as never, streams as never);
      const result = await service.startConversation('missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(TaskCreationErrors.PROJECT_NOT_FOUND);
      }
    });
  });

  describe('sendMessage', () => {
    it('returns error when session not found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();

      const service = new TaskCreationService(db as never, streams as never);
      const result = await service.sendMessage('missing', 'hello');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(TaskCreationErrors.SESSION_NOT_FOUND);
      }
    });

    it('returns error when session is completed', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      // Cancel the session to mark it as completed
      await service.cancel(startResult.value.id);

      const result = await service.sendMessage(startResult.value.id, 'hello');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_COMPLETED');
      }
    });

    it('sends message and processes streaming response', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      // Mock streaming response
      async function* mockStream() {
        yield {
          type: 'stream_event',
          session_id: 'sdk-session-1',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } },
        };
        yield {
          type: 'stream_event',
          session_id: 'sdk-session-1',
          event: { type: 'content_block_delta', delta: { type: 'text_delta', text: ' there!' } },
        };
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: { content: [{ type: 'text', text: 'Hello there!' }] },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.messages).toHaveLength(2); // user + assistant
        const userMsg = result.value.messages[0];
        const assistantMsg = result.value.messages[1];
        expect(userMsg?.role).toBe('user');
        expect(userMsg?.content).toBe('Create a task');
        expect(assistantMsg?.role).toBe('assistant');
        expect(assistantMsg?.content).toBe('Hello there!');
        expect(result.value.sdkSessionId).toBe('sdk-session-1');
        expect(result.value.systemPromptSent).toBe(true);
      }

      expect(v2Session.send).toHaveBeenCalled();
      // First message should include system prompt
      const sentMessage = v2Session.send.mock.calls[0]?.[0] as string;
      expect(sentMessage).toContain('User message: Create a task');
      expect(streams.publishTaskCreationMessage).toHaveBeenCalledTimes(2);
      expect(streams.publishTaskCreationToken).toHaveBeenCalledTimes(2);
    });

    it('parses task suggestion from response', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const suggestionJson = JSON.stringify({
        type: 'task_suggestion',
        title: 'Fix login bug',
        description: 'The login form has a validation issue',
        labels: ['bug'],
        priority: 'high',
        mode: 'implement',
      });

      // Mock streaming response with suggestion
      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: `Here's my suggestion:\n\n\`\`\`json\n${suggestionJson}\n\`\`\``,
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a bug task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).not.toBeNull();
        expect(result.value.suggestion?.title).toBe('Fix login bug');
        expect(result.value.suggestion?.priority).toBe('high');
      }

      expect(streams.publishTaskCreationSuggestion).toHaveBeenCalled();
    });

    it('handles API errors gracefully', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      v2Session.send.mockRejectedValue(new Error('API rate limit exceeded'));

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'hello');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('API_ERROR');
        expect(result.error.message).toContain('API rate limit exceeded');
      }

      expect(streams.publishTaskCreationError).toHaveBeenCalled();
    });
  });

  describe('acceptSuggestion', () => {
    it('returns error when session not found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();

      const service = new TaskCreationService(db as never, streams as never);
      const result = await service.acceptSuggestion('missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(TaskCreationErrors.SESSION_NOT_FOUND);
      }
    });

    it('returns error when no suggestion available', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.acceptSuggestion(startResult.value.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(TaskCreationErrors.NO_SUGGESTION);
      }
    });

    it('creates task from suggestion', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const suggestion: TaskSuggestion = {
        title: 'Test Task',
        description: 'Test description',
        labels: ['feature'],
        priority: 'medium',
      };

      // Mock streaming response with suggestion
      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: `\`\`\`json\n${JSON.stringify({ type: 'task_suggestion', ...suggestion })}\n\`\`\``,
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      db.insert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      });

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      // Send message to get suggestion
      await service.sendMessage(startResult.value.id, 'Create a task');

      const result = await service.acceptSuggestion(startResult.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.taskId).toBeDefined();
        expect(result.value.session.status).toBe('completed');
        expect(result.value.session.v2Session).toBeNull(); // Should be closed
      }

      expect(db.insert).toHaveBeenCalled();
      expect(streams.publishTaskCreationCompleted).toHaveBeenCalled();
    });

    it('applies overrides to suggestion', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const suggestion: TaskSuggestion = {
        title: 'Original Title',
        description: 'Test description',
        labels: ['feature'],
        priority: 'medium',
      };

      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: `\`\`\`json\n${JSON.stringify({ type: 'task_suggestion', ...suggestion })}\n\`\`\``,
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      // Capture the insert call arguments
      const valuesMock = vi.fn().mockResolvedValue(undefined);
      db.insert.mockReturnValue({ values: valuesMock });

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      await service.sendMessage(startResult.value.id, 'Create a task');

      await service.acceptSuggestion(startResult.value.id, {
        title: 'Overridden Title',
        priority: 'high',
      });

      // Verify insert was called with overridden values
      expect(valuesMock).toHaveBeenCalled();
      const insertedTask = valuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
      expect(insertedTask).toBeDefined();
      expect(insertedTask.title).toBe('Overridden Title');
      expect(insertedTask.priority).toBe('high');
      expect(insertedTask.description).toBe('Test description'); // Not overridden
    });
  });

  describe('cancel', () => {
    it('returns error when session not found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();

      const service = new TaskCreationService(db as never, streams as never);
      const result = await service.cancel('missing');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(TaskCreationErrors.SESSION_NOT_FOUND);
      }
    });

    it('cancels session and closes V2 session', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.cancel(startResult.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('cancelled');
        expect(result.value.completedAt).toBeDefined();
        expect(result.value.v2Session).toBeNull();
      }

      expect(v2Session.close).toHaveBeenCalled();
      expect(streams.publishTaskCreationCancelled).toHaveBeenCalled();
    });
  });

  describe('getSession', () => {
    it('returns null when session not found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();

      const service = new TaskCreationService(db as never, streams as never);
      const session = service.getSession('missing');

      expect(session).toBeNull();
    });

    it('returns session when found', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const session = service.getSession(startResult.value.id);

      expect(session).not.toBeNull();
      expect(session?.id).toBe(startResult.value.id);
    });
  });

  describe('suggestion parsing', () => {
    it('handles invalid JSON gracefully', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [{ type: 'text', text: '```json\n{invalid json}\n```' }],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).toBeNull();
      }
    });

    it('handles missing required fields', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: '```json\n{"type": "task_suggestion", "title": "Test"}\n```', // Missing description
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).toBeNull();
      }
    });

    it('handles wrong type field', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: '```json\n{"type": "other_type", "title": "Test", "description": "Desc"}\n```',
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).toBeNull();
      }
    });

    it('uses defaults for missing optional fields', async () => {
      const db = createDbMock();
      const streams = createStreamsMock();
      const v2Session = createV2SessionMock();

      db.query.projects.findFirst.mockResolvedValue({ id: 'p1' });
      vi.mocked(unstable_v2_createSession).mockReturnValue(v2Session as never);

      async function* mockStream() {
        yield {
          type: 'assistant',
          session_id: 'sdk-session-1',
          message: {
            content: [
              {
                type: 'text',
                text: '```json\n{"type": "task_suggestion", "title": "Test", "description": "Desc"}\n```',
              },
            ],
          },
        };
      }
      v2Session.stream.mockReturnValue(mockStream());

      const service = new TaskCreationService(db as never, streams as never);
      const startResult = await service.startConversation('p1');

      expect(startResult.ok).toBe(true);
      if (!startResult.ok) return;

      const result = await service.sendMessage(startResult.value.id, 'Create a task');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.suggestion).not.toBeNull();
        expect(result.value.suggestion?.labels).toEqual([]);
        expect(result.value.suggestion?.priority).toBe('medium');
      }
    });
  });
});
