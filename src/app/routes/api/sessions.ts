import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createSessionSchema, listSessionsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';

const { sessionService } = getApiServicesOrThrow();

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

          return Response.json(
            success({
              data: filteredSessions,
              pagination: {
                total: filteredSessions.length,
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

        return Response.json(
          success({
            data: result.value,
            pagination: {
              total: result.value.length,
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
