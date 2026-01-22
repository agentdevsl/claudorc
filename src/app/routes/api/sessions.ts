import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createSessionSchema, listSessionsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';
import type { SessionWithPresence } from '@/services/session.service';

const { sessionService } = getApiServicesOrThrow();

// Enriched session with summary data
interface SessionWithSummary extends SessionWithPresence {
  turnsUsed: number;
  tokensUsed: number;
  filesModified: number;
  linesAdded: number;
  linesRemoved: number;
}

// Fetch summaries for sessions and merge the data
async function enrichSessionsWithSummaries(
  sessions: SessionWithPresence[]
): Promise<SessionWithSummary[]> {
  // Batch fetch summaries for all sessions
  const summaryPromises = sessions.map((s) => sessionService.getSessionSummary(s.id));
  const summaryResults = await Promise.all(summaryPromises);

  return sessions.map((session, index) => {
    const summaryResult = summaryResults[index];
    const summary = summaryResult?.ok ? summaryResult.value : null;

    return {
      ...session,
      turnsUsed: summary?.turnsCount ?? 0,
      tokensUsed: summary?.tokensUsed ?? 0,
      filesModified: summary?.filesModified ?? 0,
      linesAdded: summary?.linesAdded ?? 0,
      linesRemoved: summary?.linesRemoved ?? 0,
    };
  });
}

export const Route = createFileRoute('/api/sessions')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const parsed = parseQuery(url.searchParams, listSessionsSchema);

        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { status, agentId, taskId, dateFrom, dateTo, search, limit, offset } = parsed.value;

        // Check if any filters are provided - if so, use the filtered list endpoint
        const hasFilters = status || agentId || taskId || dateFrom || dateTo || search;

        if (hasFilters) {
          // We need a projectId for filtered queries - get it from query params or use sessions without project filter
          // For now, we'll return all sessions that match the filters across projects
          // In a real implementation, you might require projectId or get it from auth context
          const result = await sessionService.list({
            limit,
            offset,
          });

          if (!result.ok) {
            return Response.json(failure(result.error), {
              status: result.error.status,
            });
          }

          // Apply client-side filtering for now (ideally this would be in the service)
          let filteredSessions = result.value;

          if (status && status.length > 0) {
            filteredSessions = filteredSessions.filter((s) => status.includes(s.status as string));
          }

          if (agentId) {
            filteredSessions = filteredSessions.filter((s) => s.agentId === agentId);
          }

          if (taskId) {
            filteredSessions = filteredSessions.filter((s) => s.taskId === taskId);
          }

          if (search) {
            const searchLower = search.toLowerCase();
            filteredSessions = filteredSessions.filter((s) =>
              s.title?.toLowerCase().includes(searchLower)
            );
          }

          // Enrich with summary data
          const enrichedSessions = await enrichSessionsWithSummaries(filteredSessions);

          return Response.json(
            success({
              data: enrichedSessions,
              pagination: {
                total: enrichedSessions.length,
                limit,
                offset,
              },
            })
          );
        }

        // No filters - return all sessions with pagination
        const result = await sessionService.list({
          limit,
          offset,
        });

        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        // Enrich with summary data
        const enrichedSessions = await enrichSessionsWithSummaries(result.value);

        return Response.json(
          success({
            data: enrichedSessions,
            pagination: {
              total: enrichedSessions.length,
              limit,
              offset,
            },
          })
        );
      }),
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createSessionSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await sessionService.create(parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
