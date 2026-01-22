import { isCuid } from '@paralleldrive/cuid2';
import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';

const { sessionService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/sessions/$id/summary')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';

        // Validate session ID format
        if (!id || !isCuid(id)) {
          return Response.json(
            failure({ code: 'INVALID_ID', message: 'Invalid session ID format', status: 400 }),
            { status: 400 }
          );
        }

        // First verify the session exists
        const sessionResult = await sessionService.getById(id);
        if (!sessionResult.ok) {
          return Response.json(failure(sessionResult.error), {
            status: sessionResult.error.status,
          });
        }

        // Get the session summary
        const result = await sessionService.getSessionSummary(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        // If no summary exists yet, return an empty summary with defaults
        const summary = result.value ?? {
          sessionId: id,
          durationMs: null,
          turnsCount: 0,
          tokensUsed: 0,
          filesModified: 0,
          linesAdded: 0,
          linesRemoved: 0,
          finalStatus: null,
        };

        // Calculate duration if session is closed
        const session = sessionResult.value;
        let computedDurationMs = summary.durationMs;
        if (!computedDurationMs && session.status === 'closed' && session.closedAt) {
          const createdAt = session.createdAt ? new Date(session.createdAt) : null;
          const closedAt = new Date(session.closedAt);

          if (
            createdAt &&
            !Number.isNaN(createdAt.getTime()) &&
            !Number.isNaN(closedAt.getTime())
          ) {
            const duration = closedAt.getTime() - createdAt.getTime();
            computedDurationMs = duration >= 0 ? duration : null;
          }
        }

        return Response.json(
          success({
            ...summary,
            durationMs: computedDurationMs,
            session: {
              id: session.id,
              status: session.status,
              title: session.title,
            },
          })
        );
      }),
    },
  },
});
