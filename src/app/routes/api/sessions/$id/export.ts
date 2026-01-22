import { isCuid } from '@paralleldrive/cuid2';
import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import type { SessionSummary } from '@/db/schema/session-summaries';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { sessionExportSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
import type { SessionEvent, SessionWithPresence } from '@/services/session.service';

const { sessionService } = getApiServicesOrThrow();

const MAX_EXPORT_EVENTS = 10_000;

export const Route = createFileRoute('/api/sessions/$id/export')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request, context }) => {
        const id = context.params?.id ?? '';

        // Validate session ID format
        if (!id || !isCuid(id)) {
          return Response.json(
            failure({ code: 'INVALID_ID', message: 'Invalid session ID format', status: 400 }),
            { status: 400 }
          );
        }

        // Parse and validate request body
        const parsed = await parseBody(request, sessionExportSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { format } = parsed.value;

        // Get session details
        const sessionResult = await sessionService.getById(id);
        if (!sessionResult.ok) {
          return Response.json(failure(sessionResult.error), {
            status: sessionResult.error.status,
          });
        }

        // Get session summary
        const summaryResult = await sessionService.getSessionSummary(id);
        if (!summaryResult.ok) {
          return Response.json(failure(summaryResult.error), {
            status: summaryResult.error.status,
          });
        }

        // Get all session events (with reasonable limit)
        const eventsResult = await sessionService.getEventsBySession(id, {
          limit: MAX_EXPORT_EVENTS,
          offset: 0,
        });
        if (!eventsResult.ok) {
          return Response.json(failure(eventsResult.error), {
            status: eventsResult.error.status,
          });
        }

        const session = sessionResult.value;
        const summary = summaryResult.value;
        const events = eventsResult.value;

        // Generate export based on format
        let content: string;
        let contentType: string;
        let filename: string;

        switch (format) {
          case 'json':
            content = exportAsJson(session, summary, events);
            contentType = 'application/json';
            filename = `session-${id}.json`;
            break;
          case 'markdown':
            content = exportAsMarkdown(session, summary, events);
            contentType = 'text/markdown';
            filename = `session-${id}.md`;
            break;
          case 'csv':
            content = exportAsCsv(events);
            contentType = 'text/csv';
            filename = `session-${id}-events.csv`;
            break;
        }

        return Response.json(
          success({
            content,
            contentType,
            filename,
          })
        );
      }),
    },
  },
});

// ===== Export Format Helpers =====

function exportAsJson(
  session: SessionWithPresence,
  summary: SessionSummary | null,
  events: SessionEvent[]
): string {
  return JSON.stringify(
    {
      session: {
        id: session.id,
        projectId: session.projectId,
        taskId: session.taskId,
        agentId: session.agentId,
        title: session.title,
        status: session.status,
        url: session.url,
      },
      summary: summary
        ? {
            durationMs: summary.durationMs,
            turnsCount: summary.turnsCount,
            tokensUsed: summary.tokensUsed,
            filesModified: summary.filesModified,
            linesAdded: summary.linesAdded,
            linesRemoved: summary.linesRemoved,
            finalStatus: summary.finalStatus,
          }
        : null,
      events: events.map((e) => ({
        id: e.id,
        type: e.type,
        timestamp: e.timestamp,
        data: e.data,
      })),
      exportedAt: new Date().toISOString(),
    },
    null,
    2
  );
}

function exportAsMarkdown(
  session: SessionWithPresence,
  summary: SessionSummary | null,
  events: SessionEvent[]
): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Session Export: ${session.title || session.id}`);
  lines.push('');
  lines.push(`**Session ID:** ${session.id}`);
  lines.push(`**Status:** ${session.status}`);
  lines.push(`**Project ID:** ${session.projectId}`);
  if (session.taskId) lines.push(`**Task ID:** ${session.taskId}`);
  if (session.agentId) lines.push(`**Agent ID:** ${session.agentId}`);
  lines.push('');

  // Summary
  if (summary) {
    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    if (summary.durationMs != null) {
      lines.push(`| Duration | ${formatDuration(summary.durationMs)} |`);
    }
    lines.push(`| Turns | ${summary.turnsCount ?? 0} |`);
    lines.push(`| Tokens Used | ${formatTokens(summary.tokensUsed ?? 0)} |`);
    lines.push(`| Files Modified | ${summary.filesModified ?? 0} |`);
    lines.push(`| Lines Added | ${summary.linesAdded ?? 0} |`);
    lines.push(`| Lines Removed | ${summary.linesRemoved ?? 0} |`);
    if (summary.finalStatus) {
      lines.push(`| Final Status | ${summary.finalStatus} |`);
    }
    lines.push('');
  }

  // Events
  lines.push('## Events');
  lines.push('');

  for (const event of events) {
    const timestamp = new Date(event.timestamp).toISOString();
    lines.push(`### ${event.type} (${timestamp})`);
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(event.data, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push(`*Exported at ${new Date().toISOString()}*`);

  return lines.join('\n');
}

function exportAsCsv(events: SessionEvent[]): string {
  const lines: string[] = [];

  // Header
  lines.push('id,type,timestamp,data');

  // Events
  for (const event of events) {
    const data = JSON.stringify(event.data).replace(/"/g, '""');
    lines.push(`"${event.id}","${event.type}","${event.timestamp}","${data}"`);
  }

  return lines.join('\n');
}

// ===== Formatting Helpers =====

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}k`;
  }
  return tokens.toString();
}
