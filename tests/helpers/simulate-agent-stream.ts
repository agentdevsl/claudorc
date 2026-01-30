/**
 * Mock SDK stream helpers for testing agent planning and execution flows.
 *
 * These helpers create async generators that simulate the Claude Agent SDK
 * stream message sequence, allowing integration tests to verify event handling
 * without an actual SDK connection.
 */

/**
 * Creates a mock SDK stream that simulates a planning session ending with ExitPlanMode.
 * Message sequence: system init → message_start → text_delta → tool_use_summary(ExitPlanMode) → result
 */
export function createPlanningStream(planText = 'Implementation plan here') {
  return (async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'sdk-session-123' };
    yield { type: 'stream_event', event: { type: 'message_start' } };
    yield {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: planText } },
    };
    yield {
      type: 'tool_use_summary',
      tool_name: 'ExitPlanMode',
      tool_use_id: 'tool-exit-1',
      is_error: false,
      summary: 'ExitPlanMode',
      preceding_tool_use_ids: [],
    };
    // The key: result comes AFTER ExitPlanMode — stream completes naturally
    yield { type: 'result', subtype: 'success', is_error: false, result: planText };
  })();
}

/**
 * Creates a mock SDK stream that simulates execution completing.
 * Message sequence: system init → message_start → text_delta → result
 */
export function createExecutionStream(resultText = 'Task completed successfully') {
  return (async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'sdk-session-123' };
    yield { type: 'stream_event', event: { type: 'message_start' } };
    yield {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: resultText } },
    };
    yield { type: 'result', subtype: 'success', is_error: false, result: resultText };
  })();
}

/**
 * Creates a mock SDK stream that simulates a planning session with an assistant
 * message appearing after ExitPlanMode (before result).
 * This tests the code path where exitPlanModeDetected is true at the assistant handler.
 */
export function createPlanningStreamWithAssistantAfterExit(planText = 'Implementation plan here') {
  return (async function* () {
    yield { type: 'system', subtype: 'init', session_id: 'sdk-session-456' };
    yield { type: 'stream_event', event: { type: 'message_start' } };
    yield {
      type: 'stream_event',
      event: { type: 'content_block_delta', delta: { type: 'text_delta', text: planText } },
    };
    yield {
      type: 'tool_use_summary',
      tool_name: 'ExitPlanMode',
      tool_use_id: 'tool-exit-2',
      is_error: false,
      summary: 'ExitPlanMode',
      preceding_tool_use_ids: [],
    };
    // Assistant message appears after ExitPlanMode but before result
    yield {
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Plan is ready for review.' }] },
    };
    yield { type: 'result', subtype: 'success', is_error: false, result: planText };
  })();
}
