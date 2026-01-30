import { describe, expect, it } from 'vitest';
import { parseJsonlFile } from '../parser.js';
import { SessionStore } from '../session-store.js';

// ── Helpers ──

function makeEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: 'user',
    uuid: 'uuid-1',
    timestamp: '2025-01-15T12:00:00.000Z',
    sessionId: 'sess-1',
    cwd: '/home/user/my-project',
    parentUuid: null,
    ...overrides,
  };
}

function toJsonl(...events: Record<string, unknown>[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n');
}

function parseEvents(
  lines: string,
  filePath = '/home/user/.claude/projects/abc123/sess-1.jsonl'
): SessionStore {
  const store = new SessionStore();
  parseJsonlFile(filePath, lines, 0, store);
  return store;
}

// ── Tests ──

describe('parseJsonlFile', () => {
  // ── Basic User Message ──

  describe('user messages', () => {
    it('creates a session with status "working" from a user message', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'Fix the login bug' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');

      expect(session).toBeDefined();
      expect(session!.status).toBe('working');
      expect(session!.sessionId).toBe('sess-1');
      expect(session!.cwd).toBe('/home/user/my-project');
      expect(session!.projectName).toBe('my-project');
    });

    it('sets goal from first user text message', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'Implement the search feature' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.goal).toBe('Implement the search feature');
    });

    it('truncates goal to 200 characters', () => {
      const longMessage = 'A'.repeat(300);
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: longMessage },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.goal).toHaveLength(200);
    });

    it('does not overwrite goal on subsequent user messages', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'First message' },
        }),
        makeEvent({
          type: 'user',
          uuid: 'uuid-2',
          message: { role: 'user', content: 'Second message' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.goal).toBe('First message');
    });

    it('clears pendingToolUse and sets status to working on tool_result', () => {
      const content = toJsonl(
        // First: assistant sends tool_use
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash' }],
          },
        }),
        // Then: user sends tool_result
        makeEvent({
          type: 'user',
          uuid: 'uuid-2',
          message: {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tool-1', content: 'ok' }],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.pendingToolUse).toBeUndefined();
      expect(session!.status).toBe('working');
    });
  });

  // ── Assistant Messages ──

  describe('assistant messages', () => {
    it('updates recentOutput from text content', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: 'I will fix the bug now.' }],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.recentOutput).toBe('I will fix the bug now.');
      expect(session!.status).toBe('working');
    });

    it('updates recentOutput from string content', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Simple text response',
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.recentOutput).toBe('Simple text response');
    });

    it('truncates recentOutput to 500 characters', () => {
      const longText = 'B'.repeat(600);
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'text', text: longText }],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.recentOutput).toHaveLength(500);
    });

    it('sets status to waiting_for_approval on tool_use', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [{ type: 'tool_use', id: 'tool-1', name: 'Bash' }],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.status).toBe('waiting_for_approval');
      expect(session!.pendingToolUse).toEqual({ toolName: 'Bash', toolId: 'tool-1' });
    });

    it('increments turnCount and sets status to waiting_for_input on stop_reason', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Done!',
            stop_reason: 'end_turn',
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.turnCount).toBe(1);
      expect(session!.status).toBe('waiting_for_input');
    });

    it('handles stop_reason null (does not increment turnCount)', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'Partial response',
            stop_reason: null,
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.turnCount).toBe(0);
      expect(session!.status).toBe('working');
    });

    it('uses last text block for recentOutput when multiple text blocks exist', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'First paragraph' },
              { type: 'text', text: 'Second paragraph' },
            ],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.recentOutput).toBe('Second paragraph');
    });
  });

  // ── Summary Event ──

  describe('summary event', () => {
    it('sets status to idle', () => {
      const content = toJsonl(
        makeEvent({
          type: 'summary',
          summary: 'Session completed successfully.',
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.status).toBe('idle');
    });
  });

  // ── Token Accumulation ──

  describe('token accumulation', () => {
    it('sums token usage across multiple assistant messages', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'First',
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              cache_creation_input_tokens: 10,
              cache_read_input_tokens: 20,
            },
          },
        }),
        makeEvent({
          type: 'assistant',
          uuid: 'uuid-2',
          message: {
            role: 'assistant',
            content: 'Second',
            usage: {
              input_tokens: 200,
              output_tokens: 80,
              cache_creation_input_tokens: 5,
              cache_read_input_tokens: 30,
            },
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.tokenUsage).toEqual({
        inputTokens: 300,
        outputTokens: 130,
        cacheCreationTokens: 15,
        cacheReadTokens: 50,
      });
    });

    it('handles missing usage field gracefully', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: 'No usage info',
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.tokenUsage).toEqual({
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      });
    });
  });

  // ── Model Extraction ──

  describe('model extraction', () => {
    it('captures model from assistant message', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            model: 'claude-sonnet-4-20250514',
            content: 'Hello!',
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.model).toBe('claude-sonnet-4-20250514');
    });
  });

  // ── Git Branch ──

  describe('git branch', () => {
    it('captures gitBranch from events', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          gitBranch: 'feature/awesome',
          message: { role: 'user', content: 'test' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.gitBranch).toBe('feature/awesome');
    });

    it('updates gitBranch from later events', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          gitBranch: 'main',
          message: { role: 'user', content: 'test' },
        }),
        makeEvent({
          type: 'assistant',
          uuid: 'uuid-2',
          gitBranch: 'feature/new',
          message: { role: 'assistant', content: 'Switched branch' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.gitBranch).toBe('feature/new');
    });
  });

  // ── Error Handling ──

  describe('error handling', () => {
    it('skips malformed non-last lines and continues parsing', () => {
      const content =
        'not valid json\n' +
        toJsonl(
          makeEvent({
            type: 'user',
            message: { role: 'user', content: 'valid event' },
          })
        );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      // Malformed non-last lines are skipped; valid lines after them are processed
      expect(session).toBeDefined();
      expect(session!.messageCount).toBe(1);
    });

    it('skips empty lines', () => {
      const content =
        '\n\n' +
        toJsonl(
          makeEvent({
            type: 'user',
            message: { role: 'user', content: 'after empty lines' },
          })
        ) +
        '\n\n';

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session).toBeDefined();
    });

    it('skips events without sessionId', () => {
      const content = toJsonl(
        { type: 'user', uuid: 'u1', timestamp: '2025-01-01T00:00:00Z' } // no sessionId
      );

      const store = parseEvents(content);
      expect(store.getSessionCount()).toBe(0);
    });

    it('skips events without type', () => {
      const content = toJsonl(
        { sessionId: 'sess-1', uuid: 'u1', timestamp: '2025-01-01T00:00:00Z' } // no type
      );

      const store = parseEvents(content);
      expect(store.getSessionCount()).toBe(0);
    });
  });

  // ── Subagent Detection ──

  describe('subagent detection', () => {
    it('sets isSubagent=true for files in /subagents/ path', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'subagent task' },
        })
      );

      const store = new SessionStore();
      parseJsonlFile(
        '/home/user/.claude/sessions/parent-sess/subagents/child-sess.jsonl',
        content,
        0,
        store
      );

      const session = store.getSession('sess-1');
      expect(session!.isSubagent).toBe(true);
      expect(session!.parentSessionId).toBe('parent-sess');
    });

    it('sets isSubagent=true when event has agentId', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          agentId: 'agent-123',
          message: { role: 'user', content: 'agent task' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.isSubagent).toBe(true);
    });

    it('sets isSubagent=false for normal session paths', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'normal task' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.isSubagent).toBe(false);
    });
  });

  // ── Project Extraction ──

  describe('project extraction', () => {
    it('extracts projectHash from file path', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'test' },
        })
      );

      const store = new SessionStore();
      parseJsonlFile('/home/user/.claude/projects/my-project-hash/sess-1.jsonl', content, 0, store);

      const session = store.getSession('sess-1');
      expect(session!.projectHash).toBe('my-project-hash');
    });

    it('extracts projectName from cwd', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          cwd: '/home/user/workspace/my-app',
          message: { role: 'user', content: 'test' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.projectName).toBe('my-app');
    });
  });

  // ── Message Counting ──

  describe('message counting', () => {
    it('counts both user and assistant messages', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'Hello' },
        }),
        makeEvent({
          type: 'assistant',
          uuid: 'uuid-2',
          message: { role: 'assistant', content: 'Hi there!' },
        }),
        makeEvent({
          type: 'user',
          uuid: 'uuid-3',
          message: { role: 'user', content: 'Thanks' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.messageCount).toBe(3);
    });
  });

  // ── Partial Line Handling ──

  describe('partial line handling', () => {
    it('returns correct byte count excluding incomplete trailing line', () => {
      const validLine = JSON.stringify(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'hello' },
        })
      );
      const incompleteLine = '{"type":"user","uuid":"u2","sessionId":"sess-1"';
      const content = `${validLine}\n${incompleteLine}`;

      const store = new SessionStore();
      const bytesConsumed = parseJsonlFile('/test/path/sess-1.jsonl', content, 0, store);

      // Should only consume the valid line + newline, not the incomplete trailing line
      expect(bytesConsumed).toBe(Buffer.byteLength(`${validLine}\n`, 'utf-8'));
      expect(store.getSession('sess-1')).toBeDefined();
    });

    it('returns 0 bytes consumed when first line is invalid', () => {
      const content = '{"incomplete json';

      const store = new SessionStore();
      const bytesConsumed = parseJsonlFile('/test/path/sess-1.jsonl', content, 0, store);

      expect(bytesConsumed).toBe(0);
    });

    it('consumes empty lines correctly', () => {
      const validLine = JSON.stringify(
        makeEvent({
          type: 'user',
          message: { role: 'user', content: 'test' },
        })
      );
      const content = `\n\n${validLine}\n`;

      const store = new SessionStore();
      const bytesConsumed = parseJsonlFile('/test/path/sess-1.jsonl', content, 0, store);

      expect(bytesConsumed).toBe(Buffer.byteLength(content, 'utf-8'));
    });
  });

  // ── Status Precedence ──

  describe('status precedence', () => {
    it('gives waiting_for_approval when message has both text and tool_use', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Let me run this command' },
              { type: 'tool_use', id: 'tool-1', name: 'Bash', input: {} },
            ],
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session).toBeDefined();
      expect(session!.status).toBe('waiting_for_approval');
      expect(session!.pendingToolUse).toEqual({ toolName: 'Bash', toolId: 'tool-1' });
    });

    it('does not override waiting_for_approval with stop_reason', () => {
      const content = toJsonl(
        makeEvent({
          type: 'assistant',
          message: {
            role: 'assistant',
            content: [
              { type: 'text', text: 'Running command' },
              { type: 'tool_use', id: 'tool-1', name: 'Bash', input: {} },
            ],
            stop_reason: 'end_turn',
          },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.status).toBe('waiting_for_approval');
    });
  });

  // ── Timestamp Updates ──

  describe('timestamps', () => {
    it('updates lastActivityAt from event timestamps', () => {
      const content = toJsonl(
        makeEvent({
          type: 'user',
          timestamp: '2025-01-15T12:00:00.000Z',
          message: { role: 'user', content: 'First' },
        }),
        makeEvent({
          type: 'assistant',
          uuid: 'uuid-2',
          timestamp: '2025-01-15T12:05:00.000Z',
          message: { role: 'assistant', content: 'Later' },
        })
      );

      const store = parseEvents(content);
      const session = store.getSession('sess-1');
      expect(session!.lastActivityAt).toBe(Date.parse('2025-01-15T12:05:00.000Z'));
    });
  });
});
