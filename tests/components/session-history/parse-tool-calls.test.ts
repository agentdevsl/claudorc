import { describe, expect, it } from 'vitest';
import type { ToolCallEntry } from '@/app/components/features/session-history/types';
import {
  calculateToolCallStats,
  parseToolCallsFromEvents,
} from '@/app/components/features/session-history/utils/parse-tool-calls';
import type { SessionEvent } from '@/services/session.service';

/**
 * Helper to create a mock SessionEvent
 */
function createMockEvent(
  overrides: Partial<SessionEvent> & { type: SessionEvent['type']; data: unknown }
): SessionEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Helper to create a tool:start event
 */
function createToolStartEvent(
  toolCallId: string,
  toolName: string,
  input: Record<string, unknown>,
  timestamp: number
): SessionEvent {
  return createMockEvent({
    type: 'tool:start',
    timestamp,
    data: {
      id: toolCallId,
      name: toolName,
      input,
    },
  });
}

/**
 * Helper to create a tool:result event
 */
function createToolResultEvent(
  toolCallId: string,
  toolName: string,
  output: unknown,
  timestamp: number,
  error?: string
): SessionEvent {
  return createMockEvent({
    type: 'tool:result',
    timestamp,
    data: {
      id: toolCallId,
      name: toolName,
      output,
      error,
    },
  });
}

describe('parseToolCallsFromEvents', () => {
  const sessionStartTime = 1706284800000; // Fixed timestamp for tests

  it('parses empty events array returns empty tool calls', () => {
    const result = parseToolCallsFromEvents([], sessionStartTime);

    expect(result).toEqual([]);
  });

  it('pairs tool:start with tool:result events correctly by ID', () => {
    const startEvent = createToolStartEvent(
      'tool-1',
      'Read',
      { file_path: '/test.ts' },
      sessionStartTime + 1000
    );
    const resultEvent = createToolResultEvent(
      'tool-1',
      'Read',
      'file contents',
      sessionStartTime + 2000
    );

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'tool-1',
      tool: 'Read',
      input: { file_path: '/test.ts' },
      output: 'file contents',
      status: 'complete',
      duration: 1000,
    });
  });

  it('sets status to running for unpaired tool:start events (no matching result)', () => {
    const startEvent = createToolStartEvent(
      'tool-orphan',
      'Grep',
      { pattern: 'test' },
      sessionStartTime + 500
    );

    const result = parseToolCallsFromEvents([startEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'tool-orphan',
      tool: 'Grep',
      status: 'running',
      duration: undefined,
      output: undefined,
    });
  });

  it('sets status to error when tool:result has error field', () => {
    const startEvent = createToolStartEvent(
      'tool-err',
      'Edit',
      { file_path: '/missing.ts' },
      sessionStartTime + 100
    );
    const resultEvent = createToolResultEvent(
      'tool-err',
      'Edit',
      undefined,
      sessionStartTime + 200,
      'File not found'
    );

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'tool-err',
      status: 'error',
      error: 'File not found',
      duration: 100,
    });
  });

  it('sets status to complete when tool:result has no error', () => {
    const startEvent = createToolStartEvent(
      'tool-ok',
      'Bash',
      { command: 'ls' },
      sessionStartTime + 300
    );
    const resultEvent = createToolResultEvent(
      'tool-ok',
      'Bash',
      'file1.ts\nfile2.ts',
      sessionStartTime + 450
    );

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'tool-ok',
      status: 'complete',
      error: undefined,
    });
  });

  it('calculates duration correctly (result timestamp - start timestamp)', () => {
    const startTimestamp = sessionStartTime + 1000;
    const resultTimestamp = sessionStartTime + 3500;
    const expectedDuration = 2500;

    const startEvent = createToolStartEvent(
      'tool-dur',
      'Read',
      { file_path: '/a.ts' },
      startTimestamp
    );
    const resultEvent = createToolResultEvent('tool-dur', 'Read', 'content', resultTimestamp);

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result[0]?.duration).toBe(expectedDuration);
  });

  it('sorts tool calls by timestamp ascending', () => {
    const events = [
      createToolStartEvent('tool-3', 'Grep', { pattern: 'c' }, sessionStartTime + 3000),
      createToolResultEvent('tool-3', 'Grep', 'match c', sessionStartTime + 3500),
      createToolStartEvent('tool-1', 'Read', { file_path: '/a.ts' }, sessionStartTime + 1000),
      createToolResultEvent('tool-1', 'Read', 'content a', sessionStartTime + 1500),
      createToolStartEvent('tool-2', 'Edit', { file_path: '/b.ts' }, sessionStartTime + 2000),
      createToolResultEvent('tool-2', 'Edit', 'edited b', sessionStartTime + 2500),
    ];

    const result = parseToolCallsFromEvents(events, sessionStartTime);

    expect(result).toHaveLength(3);
    expect(result[0]?.id).toBe('tool-1');
    expect(result[1]?.id).toBe('tool-2');
    expect(result[2]?.id).toBe('tool-3');
  });

  it('handles events with missing IDs gracefully (skips them)', () => {
    const validStart = createToolStartEvent(
      'tool-valid',
      'Read',
      { file_path: '/test.ts' },
      sessionStartTime + 100
    );
    const validResult = createToolResultEvent(
      'tool-valid',
      'Read',
      'contents',
      sessionStartTime + 200
    );

    // Event with missing ID in data
    const invalidStart = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 300,
      data: { name: 'Grep', input: { pattern: 'foo' } }, // No id field
    });

    const invalidResult = createMockEvent({
      type: 'tool:result',
      timestamp: sessionStartTime + 400,
      data: { name: 'Grep', output: 'bar' }, // No id field
    });

    const result = parseToolCallsFromEvents(
      [validStart, invalidStart, validResult, invalidResult],
      sessionStartTime
    );

    // Only the valid tool call should be included
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('tool-valid');
  });

  it('formats timeOffset correctly using session start time', () => {
    // Tool starts 95 seconds after session start (1:35)
    const startEvent = createToolStartEvent(
      'tool-time',
      'Read',
      { file_path: '/x.ts' },
      sessionStartTime + 95000
    );
    const resultEvent = createToolResultEvent(
      'tool-time',
      'Read',
      'data',
      sessionStartTime + 96000
    );

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result[0]?.timeOffset).toBe('1:35');
  });

  it('handles multiple tool calls with some running and some complete', () => {
    const events = [
      createToolStartEvent('tool-a', 'Read', { file_path: '/a.ts' }, sessionStartTime + 1000),
      createToolResultEvent('tool-a', 'Read', 'content a', sessionStartTime + 1500),
      createToolStartEvent('tool-b', 'Grep', { pattern: 'search' }, sessionStartTime + 2000),
      // tool-b has no result - still running
      createToolStartEvent('tool-c', 'Edit', { file_path: '/c.ts' }, sessionStartTime + 3000),
      createToolResultEvent(
        'tool-c',
        'Edit',
        undefined,
        sessionStartTime + 3200,
        'Permission denied'
      ),
    ];

    const result = parseToolCallsFromEvents(events, sessionStartTime);

    expect(result).toHaveLength(3);
    expect(result.find((tc) => tc.id === 'tool-a')?.status).toBe('complete');
    expect(result.find((tc) => tc.id === 'tool-b')?.status).toBe('running');
    expect(result.find((tc) => tc.id === 'tool-c')?.status).toBe('error');
  });

  it('uses "[unnamed tool]" as tool name when name is missing from data', () => {
    const startEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: { id: 'tool-noname', input: {} }, // No name field
    });

    const result = parseToolCallsFromEvents([startEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.tool).toBe('[unnamed tool]');
  });

  it('uses "tool" field (newer streaming hooks format) when present', () => {
    const startEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: { id: 'tool-new', tool: 'Read', input: { file_path: '/test.ts' } },
    });
    const resultEvent = createMockEvent({
      type: 'tool:result',
      timestamp: sessionStartTime + 200,
      data: { id: 'tool-new', tool: 'Read', output: 'file contents' },
    });

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.tool).toBe('Read');
    expect(result[0]?.status).toBe('complete');
  });

  it('prefers "tool" field over "name" field when both are present', () => {
    const startEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: { id: 'tool-both', tool: 'Read', name: 'OldName', input: {} },
    });

    const result = parseToolCallsFromEvents([startEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.tool).toBe('Read');
  });

  it('sets status to error when tool:result has isError flag (streaming hooks format)', () => {
    const startEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: { id: 'tool-iserr', tool: 'Bash', input: { command: 'fail' } },
    });
    const resultEvent = createMockEvent({
      type: 'tool:result',
      timestamp: sessionStartTime + 200,
      data: { id: 'tool-iserr', tool: 'Bash', output: { is_error: true }, isError: true },
    });

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('error');
    expect(result[0]?.error).toBe('Tool execution failed');
  });

  it('clamps negative duration to 0 when result timestamp is before start timestamp', () => {
    const startEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 2000, // Start at 2s
      data: { id: 'tool-neg', tool: 'Read', input: { path: '/test' } },
    });
    const resultEvent = createMockEvent({
      type: 'tool:result',
      timestamp: sessionStartTime + 1000, // Result at 1s - BEFORE start!
      data: { id: 'tool-neg', tool: 'Read', output: 'data', isError: false },
    });

    const result = parseToolCallsFromEvents([startEvent, resultEvent], sessionStartTime);

    expect(result).toHaveLength(1);
    expect(result[0]?.duration).toBe(0); // Should be 0, not -1000
  });

  it('does not include orphan tool:result events (results without matching starts)', () => {
    const orphanResult = createMockEvent({
      type: 'tool:result',
      timestamp: sessionStartTime + 1000,
      data: { id: 'orphan-id', tool: 'Read', output: 'data', isError: false },
    });

    const result = parseToolCallsFromEvents([orphanResult], sessionStartTime);

    expect(result).toHaveLength(0);
  });

  it('rejects tool:start events with array data', () => {
    const arrayDataEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: ['not', 'an', 'object'],
    });

    const result = parseToolCallsFromEvents([arrayDataEvent], sessionStartTime);
    expect(result).toHaveLength(0);
  });

  it('rejects tool:start events with empty string id', () => {
    const emptyIdEvent = createMockEvent({
      type: 'tool:start',
      timestamp: sessionStartTime + 100,
      data: { id: '', tool: 'Read', input: {} },
    });

    const result = parseToolCallsFromEvents([emptyIdEvent], sessionStartTime);
    expect(result).toHaveLength(0);
  });
});

describe('calculateToolCallStats', () => {
  it('returns zero stats for empty array', () => {
    const result = calculateToolCallStats([]);

    expect(result).toEqual({
      totalCalls: 0,
      errorCount: 0,
      avgDurationMs: 0,
      totalDurationMs: 0,
      toolBreakdown: [],
    });
  });

  it('counts total calls correctly', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'complete' }),
      createToolCallEntry({ id: '2', tool: 'Grep', status: 'complete' }),
      createToolCallEntry({ id: '3', tool: 'Edit', status: 'running' }),
    ];

    const result = calculateToolCallStats(toolCalls);

    expect(result.totalCalls).toBe(3);
  });

  it('counts error status calls', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'complete' }),
      createToolCallEntry({ id: '2', tool: 'Edit', status: 'error', error: 'failed' }),
      createToolCallEntry({ id: '3', tool: 'Bash', status: 'error', error: 'timeout' }),
      createToolCallEntry({ id: '4', tool: 'Grep', status: 'running' }),
    ];

    const result = calculateToolCallStats(toolCalls);

    expect(result.errorCount).toBe(2);
  });

  it('calculates average duration only from calls with duration', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'complete', duration: 100 }),
      createToolCallEntry({ id: '2', tool: 'Grep', status: 'complete', duration: 200 }),
      createToolCallEntry({ id: '3', tool: 'Edit', status: 'running', duration: undefined }), // No duration
      createToolCallEntry({ id: '4', tool: 'Bash', status: 'complete', duration: 300 }),
    ];

    const result = calculateToolCallStats(toolCalls);

    // Average of 100, 200, 300 = 200
    expect(result.avgDurationMs).toBe(200);
  });

  it('creates toolBreakdown sorted by count descending', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'complete' }),
      createToolCallEntry({ id: '2', tool: 'Grep', status: 'complete' }),
      createToolCallEntry({ id: '3', tool: 'Read', status: 'complete' }),
      createToolCallEntry({ id: '4', tool: 'Edit', status: 'complete' }),
      createToolCallEntry({ id: '5', tool: 'Read', status: 'complete' }),
      createToolCallEntry({ id: '6', tool: 'Grep', status: 'complete' }),
    ];

    const result = calculateToolCallStats(toolCalls);

    expect(result.toolBreakdown).toEqual([
      { tool: 'Read', count: 3 },
      { tool: 'Grep', count: 2 },
      { tool: 'Edit', count: 1 },
    ]);
  });

  it('handles calls without duration (running) in avg calculation', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'running', duration: undefined }),
      createToolCallEntry({ id: '2', tool: 'Grep', status: 'running', duration: undefined }),
    ];

    const result = calculateToolCallStats(toolCalls);

    // No calls with duration, so average should be 0
    expect(result.avgDurationMs).toBe(0);
  });

  it('handles mix of tools and statuses correctly', () => {
    const toolCalls: ToolCallEntry[] = [
      createToolCallEntry({ id: '1', tool: 'Read', status: 'complete', duration: 50 }),
      createToolCallEntry({
        id: '2',
        tool: 'Read',
        status: 'error',
        duration: 10,
        error: 'not found',
      }),
      createToolCallEntry({ id: '3', tool: 'Bash', status: 'complete', duration: 150 }),
      createToolCallEntry({ id: '4', tool: 'Bash', status: 'running', duration: undefined }),
      createToolCallEntry({ id: '5', tool: 'Glob', status: 'complete', duration: 30 }),
    ];

    const result = calculateToolCallStats(toolCalls);

    expect(result.totalCalls).toBe(5);
    expect(result.errorCount).toBe(1);
    // Average of 50, 10, 150, 30 = 240 / 4 = 60
    expect(result.avgDurationMs).toBe(60);
    expect(result.toolBreakdown).toEqual([
      { tool: 'Read', count: 2 },
      { tool: 'Bash', count: 2 },
      { tool: 'Glob', count: 1 },
    ]);
  });
});

/**
 * Helper to create a ToolCallEntry for testing calculateToolCallStats
 */
function createToolCallEntry(
  overrides: Partial<ToolCallEntry> & Pick<ToolCallEntry, 'id' | 'tool' | 'status'>
): ToolCallEntry {
  return {
    input: {},
    output: undefined,
    timestamp: Date.now(),
    timeOffset: '0:00',
    ...overrides,
  };
}
