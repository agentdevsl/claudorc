import type { SessionEvent } from '@/services/session.service';
import type { ToolCallEntry, ToolCallStats, ToolCallStatus } from '../types';
import { calculateTimeOffset, formatTimeOffset } from './format-duration';

const LOG_PREFIX = '[parse-tool-calls]';

/**
 * Data structure for tool:start events from durable streams.
 * All properties except id are optional to handle malformed events gracefully.
 * Supports both legacy `name` field and newer `tool` field.
 */
interface ToolStartData {
  id: string;
  /** Tool name (newer format from streaming hooks) */
  tool?: string;
  /** Tool name (legacy format) */
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Data structure for tool:result events from durable streams.
 * All properties except id are optional to handle malformed events gracefully.
 * Supports both legacy `name` field and newer `tool` field.
 */
interface ToolResultData {
  id: string;
  /** Tool name (newer format from streaming hooks) */
  tool?: string;
  /** Tool name (legacy format) */
  name?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  /** Error message (legacy format) */
  error?: string;
  /** Error flag from streaming hooks */
  isError?: boolean;
}

/**
 * Validates and narrows event data to ToolStartData.
 * Checks that data is a non-null, non-array object with a string id.
 */
function isToolStartData(data: unknown): data is ToolStartData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  // id must be a non-empty string for pairing
  if (!('id' in obj) || typeof obj.id !== 'string' || obj.id === '') {
    return false;
  }
  // tool or name should be string if present
  if ('tool' in obj && obj.tool !== undefined && typeof obj.tool !== 'string') {
    console.warn(LOG_PREFIX, 'tool:start event has non-string tool:', obj.tool);
    return false;
  }
  if ('name' in obj && obj.name !== undefined && typeof obj.name !== 'string') {
    console.warn(LOG_PREFIX, 'tool:start event has non-string name:', obj.name);
    return false;
  }
  return true;
}

/**
 * Validates and narrows event data to ToolResultData.
 * Checks that data is a non-null, non-array object with a string id.
 */
function isToolResultData(data: unknown): data is ToolResultData {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return false;
  }
  const obj = data as Record<string, unknown>;
  // id must be a non-empty string for pairing
  if (!('id' in obj) || typeof obj.id !== 'string' || obj.id === '') {
    return false;
  }
  return true;
}

/**
 * Parse tool calls from session events
 *
 * Pairs tool:start events with their corresponding tool:result events by ID.
 * Calculates duration from timestamp differences.
 *
 * Logs warnings for:
 *   - Malformed events (missing/invalid id)
 *   - Orphan tool:result events (results without matching starts)
 *
 * Note: Orphan tool:start events (no result yet) are returned with status 'running'
 * and do not generate warnings - this is expected for in-progress tool calls.
 *
 * @param events - Array of session events
 * @param sessionStartTime - Unix timestamp (ms) when session started
 * @returns Array of tool call entries sorted by timestamp ascending
 */
export function parseToolCallsFromEvents(
  events: SessionEvent[],
  sessionStartTime: number
): ToolCallEntry[] {
  // Map to store tool:start events by ID for pairing
  const startEventsById = new Map<string, { event: SessionEvent; data: ToolStartData }>();

  // Map to store tool:result events by ID
  const resultEventsById = new Map<string, { event: SessionEvent; data: ToolResultData }>();

  // Track malformed events for logging
  let droppedStartCount = 0;
  let droppedResultCount = 0;

  // Process all events and categorize them
  for (const event of events) {
    if (event.type === 'tool:start') {
      if (isToolStartData(event.data)) {
        startEventsById.set(event.data.id, { event, data: event.data });
      } else {
        droppedStartCount++;
      }
    } else if (event.type === 'tool:result') {
      if (isToolResultData(event.data)) {
        resultEventsById.set(event.data.id, { event, data: event.data });
      } else {
        droppedResultCount++;
      }
    }
  }

  // Log dropped events
  if (droppedStartCount > 0) {
    console.warn(
      LOG_PREFIX,
      `Dropped ${droppedStartCount} tool:start event(s) with missing or invalid id`
    );
  }
  if (droppedResultCount > 0) {
    console.warn(
      LOG_PREFIX,
      `Dropped ${droppedResultCount} tool:result event(s) with missing or invalid id`
    );
  }

  const toolCalls: ToolCallEntry[] = [];

  // Process all tool:start events
  for (const [id, { event: startEvent, data: startData }] of startEventsById) {
    const resultEntry = resultEventsById.get(id);
    const offsetMs = calculateTimeOffset(startEvent.timestamp, sessionStartTime);

    let status: ToolCallStatus;
    let duration: number | undefined;
    let output: unknown;
    let error: string | undefined;

    if (resultEntry) {
      const { event: resultEvent, data: resultData } = resultEntry;

      // Calculate duration from start to result
      const calculatedDuration = resultEvent.timestamp - startEvent.timestamp;

      // Validate duration is not negative (timestamps out of order)
      if (calculatedDuration < 0) {
        console.warn(
          LOG_PREFIX,
          'Negative duration detected for tool call. ID:',
          id,
          'Start:',
          startEvent.timestamp,
          'End:',
          resultEvent.timestamp
        );
        duration = 0;
      } else {
        duration = calculatedDuration;
      }

      // Determine status based on result (check both error and isError fields)
      if (resultData.error || resultData.isError) {
        status = 'error';
        error = resultData.error ?? 'Tool execution failed';
      } else {
        status = 'complete';
      }

      output = resultData.output;
    } else {
      // No matching result - tool is still running
      status = 'running';
    }

    // Get tool name (prefer 'tool' field over 'name' for newer streaming hooks format)
    const toolName = startData.tool ?? startData.name;
    if (!toolName) {
      console.warn(
        LOG_PREFIX,
        'Tool call missing name. ID:',
        id,
        'Timestamp:',
        startEvent.timestamp
      );
    }

    toolCalls.push({
      id,
      tool: toolName ?? '[unnamed tool]',
      input: startData.input,
      output,
      status,
      duration,
      timestamp: startEvent.timestamp,
      timeOffset: formatTimeOffset(offsetMs),
      error,
    });
  }

  // Check for orphan result events (results without matching starts)
  for (const [id] of resultEventsById) {
    if (!startEventsById.has(id)) {
      console.warn(LOG_PREFIX, 'Found tool:result without matching tool:start. ID:', id);
    }
  }

  // Sort by timestamp ascending
  toolCalls.sort((a, b) => a.timestamp - b.timestamp);

  return toolCalls;
}

/**
 * Calculate aggregate statistics from tool calls
 *
 * @param toolCalls - Array of tool call entries
 * @returns Aggregate statistics including totals, averages, and breakdown by tool
 */
export function calculateToolCallStats(toolCalls: readonly ToolCallEntry[]): ToolCallStats {
  const totalCalls = toolCalls.length;
  const errorCount = toolCalls.filter((tc) => tc.status === 'error').length;

  // Calculate average and total duration for all calls with recorded duration (complete or error)
  const callsWithDuration = toolCalls.filter((tc) => tc.duration !== undefined && tc.duration >= 0);
  const totalDurationMs = callsWithDuration.reduce((sum, tc) => sum + (tc.duration ?? 0), 0);
  const avgDurationMs =
    callsWithDuration.length > 0 ? totalDurationMs / callsWithDuration.length : 0;

  // Calculate breakdown by tool name
  const toolCountMap = new Map<string, number>();
  for (const tc of toolCalls) {
    const currentCount = toolCountMap.get(tc.tool) ?? 0;
    toolCountMap.set(tc.tool, currentCount + 1);
  }

  // Convert to array and sort by count descending
  const toolBreakdown = Array.from(toolCountMap.entries())
    .map(([tool, count]) => ({ tool, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalCalls,
    errorCount,
    avgDurationMs,
    totalDurationMs,
    toolBreakdown,
  };
}
