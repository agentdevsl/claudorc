import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import type {
  SessionDetail,
  SessionFilters,
  SessionListItem,
  SessionSort,
  StreamEntry,
  StreamEntryType,
  ToolCallEntry,
  ToolCallStats,
} from '../types';
import { calculateTimeOffset, formatTimeOffset } from '../utils/format-duration';
import { calculateToolCallStats, parseToolCallsFromEvents } from '../utils/parse-tool-calls';

// Types for API responses
interface SessionListResponse {
  sessions: SessionListItem[];
  total: number;
  hasMore: boolean;
}

interface SessionDetailResponse {
  session: SessionDetail;
}

/**
 * Hook for fetching sessions list
 */
export function useSessions(projectId: string, filters?: SessionFilters, sort?: SessionSort) {
  const [data, setData] = useState<SessionListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<{ message: string } | null>(null);

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await apiClient.sessions.list({
        projectId,
        limit: 50,
      });

      if (result.ok) {
        // Transform the response to match our expected type
        const items = (result.data.data as SessionListItem[]) ?? [];

        // Apply client-side filtering
        let filtered = items;

        if (filters?.status && filters.status.length > 0) {
          filtered = filtered.filter((s) => filters.status?.includes(s.status));
        }

        if (filters?.agentId) {
          filtered = filtered.filter((s) => s.agentId === filters.agentId);
        }

        if (filters?.taskId) {
          filtered = filtered.filter((s) => s.taskId === filters.taskId);
        }

        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(
            (s) =>
              s.title?.toLowerCase().includes(searchLower) ||
              s.taskTitle?.toLowerCase().includes(searchLower) ||
              s.agentName?.toLowerCase().includes(searchLower)
          );
        }

        if (filters?.dateFrom) {
          const fromDate = new Date(filters.dateFrom);
          if (Number.isNaN(fromDate.getTime())) {
            console.warn('[useSessions] Invalid dateFrom filter value:', filters.dateFrom);
          } else {
            filtered = filtered.filter((s) => new Date(s.createdAt) >= fromDate);
          }
        }

        if (filters?.dateTo) {
          const toDate = new Date(filters.dateTo);
          if (Number.isNaN(toDate.getTime())) {
            console.warn('[useSessions] Invalid dateTo filter value:', filters.dateTo);
          } else {
            filtered = filtered.filter((s) => new Date(s.createdAt) <= toDate);
          }
        }

        // Apply sorting
        if (sort) {
          filtered = [...filtered].sort((a, b) => {
            let aVal: number;
            let bVal: number;

            switch (sort.field) {
              case 'createdAt':
                aVal = new Date(a.createdAt).getTime();
                bVal = new Date(b.createdAt).getTime();
                break;
              case 'closedAt':
                aVal = a.closedAt ? new Date(a.closedAt).getTime() : 0;
                bVal = b.closedAt ? new Date(b.closedAt).getTime() : 0;
                break;
              case 'duration':
                aVal = a.duration ?? 0;
                bVal = b.duration ?? 0;
                break;
              default:
                aVal = new Date(a.createdAt).getTime();
                bVal = new Date(b.createdAt).getTime();
            }

            return sort.direction === 'asc' ? aVal - bVal : bVal - aVal;
          });
        }

        setData({
          sessions: filtered,
          total: filtered.length,
          hasMore: false,
        });
      } else {
        setError({ message: result.error.message });
      }
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Failed to fetch sessions' });
    } finally {
      setIsLoading(false);
    }
  }, [projectId, filters, sort]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  return { data, isLoading, error, refetch: fetchSessions };
}

interface PartialErrors {
  events?: string;
  summary?: string;
}

interface UseSessionDetailReturn {
  data: SessionDetailResponse | null;
  isLoading: boolean;
  error: { message: string } | null;
  partialErrors: PartialErrors | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching session detail with events and summary.
 * Returns partial errors when events or summary fail but session succeeds.
 */
export function useSessionDetail(sessionId: string | null): UseSessionDetailReturn {
  const [data, setData] = useState<SessionDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<{ message: string } | null>(null);
  const [partialErrors, setPartialErrors] = useState<PartialErrors | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!sessionId) {
      setData(null);
      setPartialErrors(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setPartialErrors(null);

    try {
      // Fetch session, events, and summary in parallel
      const [sessionResult, eventsResult, summaryResult] = await Promise.all([
        apiClient.sessions.get(sessionId),
        apiClient.sessions.getEvents(sessionId, { limit: 1000 }),
        apiClient.sessions.getSummary(sessionId),
      ]);

      if (!sessionResult.ok) {
        setError({ message: sessionResult.error.message });
        return;
      }

      // Track partial errors for non-critical failures
      const errors: PartialErrors = {};

      // Transform the response to match our expected type
      const session = sessionResult.data as unknown as SessionDetail;

      // Get events from the events endpoint
      let events: SessionDetail['events'] = [];
      if (eventsResult.ok && eventsResult.data?.data) {
        events = eventsResult.data.data.map((e) => ({
          id: e.id,
          type: e.type as SessionDetail['events'][0]['type'],
          timestamp: e.timestamp,
          data: e.data,
        }));
      } else if (!eventsResult.ok) {
        errors.events = eventsResult.error.message;
      }

      // Get metrics from summary
      type SummaryData = {
        sessionId: string;
        durationMs: number | null;
        turnsCount: number;
        tokensUsed: number;
        filesModified: number;
        linesAdded: number;
        linesRemoved: number;
        finalStatus: 'success' | 'failed' | 'cancelled' | null;
        session: { id: string; status: string; title: string | null };
      };
      let summary: SummaryData | null = null;
      if (summaryResult.ok) {
        summary = summaryResult.data;
      } else {
        errors.summary = summaryResult.error.message;
      }

      // Set partial errors if any occurred
      if (Object.keys(errors).length > 0) {
        setPartialErrors(errors);
      }

      // Ensure required fields have defaults
      setData({
        session: {
          ...session,
          events,
          filesModified: summary?.filesModified ?? session.filesModified ?? 0,
          linesAdded: summary?.linesAdded ?? session.linesAdded ?? 0,
          linesRemoved: summary?.linesRemoved ?? session.linesRemoved ?? 0,
          testsRun: session.testsRun ?? 0,
          testsPassed: session.testsPassed ?? 0,
          turnsUsed: summary?.turnsCount ?? session.turnsUsed ?? 0,
          tokensUsed: summary?.tokensUsed ?? session.tokensUsed ?? 0,
          duration: summary?.durationMs ?? session.duration ?? null,
        },
      });
    } catch (err) {
      setError({ message: err instanceof Error ? err.message : 'Failed to fetch session' });
    } finally {
      setIsLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  return { data, isLoading, error, partialErrors, refetch: fetchDetail };
}

/**
 * Tool start event data structure
 */
interface ToolStartData {
  id?: string;
  tool?: string;
  name?: string;
  input?: Record<string, unknown>;
}

/**
 * Tool result event data structure
 */
interface ToolResultData {
  id?: string;
  tool?: string;
  name?: string;
  input?: Record<string, unknown>;
  output?: unknown;
  error?: string;
  isError?: boolean;
  duration?: number;
}

/**
 * Parse session events into stream entries for display.
 * Consolidates tool:start and tool:result events into single entries.
 */
export function parseEventsToStreamEntries(
  events: SessionDetail['events'],
  sessionStartTime: number
): StreamEntry[] {
  if (!events || events.length === 0) {
    return [];
  }

  // Build a map of tool:start events by ID for pairing
  const toolStartEvents = new Map<
    string,
    { event: SessionDetail['events'][0]; data: ToolStartData }
  >();

  for (const event of events) {
    if (event.type === 'tool:start') {
      const data = event.data as ToolStartData;
      if (data.id) {
        toolStartEvents.set(data.id, { event, data });
      }
    }
  }

  // Track which tool:start events have been paired with results
  const pairedToolStartIds = new Set<string>();

  const entries: StreamEntry[] = [];

  for (const event of events) {
    const timeOffsetMs = calculateTimeOffset(event.timestamp, sessionStartTime);
    const timeOffset = formatTimeOffset(timeOffsetMs);

    // Determine entry type based on event type
    let type: StreamEntryType = 'system';
    let content = '';
    let toolCall: StreamEntry['toolCall'];

    switch (event.type) {
      case 'agent:started':
        type = 'system';
        content = `Session started. ${(event.data as { message?: string })?.message ?? ''}`;
        break;

      case 'agent:completed':
        type = 'system';
        content = `Session completed successfully. ${(event.data as { message?: string })?.message ?? ''}`;
        break;

      case 'agent:error':
        type = 'system';
        content = `Error: ${(event.data as { error?: string })?.error ?? 'Unknown error'}`;
        break;

      case 'chunk': {
        const chunkData = event.data as {
          role?: string;
          content?: string;
          model?: string;
          usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
        };
        if (chunkData.role === 'user') {
          type = 'user';
          content = chunkData.content ?? '';
        } else if (chunkData.role === 'assistant') {
          type = 'assistant';
          content = chunkData.content ?? '';
        } else {
          type = 'system';
          content = chunkData.content ?? '';
        }
        // Extract model and usage for display
        const model = chunkData.model;
        const usage = chunkData.usage
          ? {
              inputTokens: chunkData.usage.inputTokens ?? 0,
              outputTokens: chunkData.usage.outputTokens ?? 0,
              totalTokens: chunkData.usage.totalTokens ?? 0,
            }
          : undefined;

        entries.push({
          id: event.id,
          type,
          timestamp: event.timestamp,
          timeOffset,
          content,
          model,
          usage,
        });
        continue;
      }

      case 'tool:start': {
        // Check if this start event will be paired with a result
        const toolData = event.data as ToolStartData;
        const toolId = toolData.id;

        // Look ahead to see if there's a matching result event
        const hasMatchingResult = toolId
          ? events.some((e) => e.type === 'tool:result' && (e.data as ToolResultData).id === toolId)
          : false;

        if (hasMatchingResult) {
          // Skip this event - it will be consolidated with the result
          continue;
        }

        // No matching result - show as running
        type = 'tool';
        const toolName = toolData.tool ?? toolData.name ?? 'Unknown';
        content = `${toolName}`;
        toolCall = {
          name: toolName,
          input: toolData.input ?? {},
          status: 'running',
          startTimeOffset: timeOffset,
        };
        break;
      }

      case 'tool:result': {
        type = 'tool';
        const resultData = event.data as ToolResultData;
        const toolId = resultData.id;

        // Get tool name from result or paired start event
        const toolName = resultData.tool ?? resultData.name ?? 'Unknown';
        const hasError = resultData.error || resultData.isError;

        // Find the paired start event for timing info
        let startTimeOffset = timeOffset;
        let duration: number | undefined;

        if (toolId) {
          const startEntry = toolStartEvents.get(toolId);
          if (startEntry) {
            pairedToolStartIds.add(toolId);
            const startOffsetMs = calculateTimeOffset(startEntry.event.timestamp, sessionStartTime);
            startTimeOffset = formatTimeOffset(startOffsetMs);
            duration = resultData.duration ?? event.timestamp - startEntry.event.timestamp;
          }
        }

        content = toolName;
        toolCall = {
          name: toolName,
          input: resultData.input ?? {},
          output: resultData.output,
          status: hasError ? 'error' : 'complete',
          startTimeOffset,
          endTimeOffset: timeOffset,
          duration,
          error: hasError ? (resultData.error ?? 'Tool execution failed') : undefined,
        };
        break;
      }

      case 'terminal:input':
        type = 'user';
        content = (event.data as { input?: string })?.input ?? '';
        break;

      case 'terminal:output':
        type = 'assistant';
        content = (event.data as { output?: string })?.output ?? '';
        break;

      default:
        type = 'system';
        content = JSON.stringify(event.data);
    }

    entries.push({
      id: event.id,
      type,
      timestamp: event.timestamp,
      timeOffset,
      content,
      toolCall,
    });
  }

  return entries;
}

const EMPTY_STATS: ToolCallStats = {
  totalCalls: 0,
  errorCount: 0,
  avgDurationMs: 0,
  totalDurationMs: 0,
  toolBreakdown: [],
};

const EMPTY_RESULT = {
  entries: [] as StreamEntry[],
  toolCalls: [] as ToolCallEntry[],
  toolCallStats: EMPTY_STATS,
  isLoading: false,
  error: undefined as string | undefined,
};

/**
 * Hook for session events with parsed stream entries and tool call data.
 * Memoizes parsing results to avoid recomputation on every render.
 */
export function useSessionEvents(session: SessionDetail | null) {
  return useMemo(() => {
    if (!session) {
      return EMPTY_RESULT;
    }

    // Validate session timestamp
    const sessionStartDate = new Date(session.createdAt);
    const sessionStartTime = sessionStartDate.getTime();

    if (Number.isNaN(sessionStartTime)) {
      console.error(
        '[useSessionEvents] Invalid session createdAt timestamp:',
        session.createdAt,
        'Session ID:',
        session.id
      );
      return {
        ...EMPTY_RESULT,
        error: 'Session has invalid timestamp data',
      };
    }

    const entries = parseEventsToStreamEntries(session.events, sessionStartTime);
    const toolCalls = parseToolCallsFromEvents(session.events, sessionStartTime);
    const toolCallStats = calculateToolCallStats(toolCalls);

    return { entries, toolCalls, toolCallStats, isLoading: false, error: undefined };
  }, [session]);
}
