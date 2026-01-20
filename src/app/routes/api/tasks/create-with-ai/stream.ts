import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/tasks/create-with-ai/stream')({
  server: {
    handlers: {
      /**
       * GET /api/tasks/create-with-ai/stream - SSE stream for task creation events
       *
       * Query params:
       * - sessionId: The task creation session ID to stream events for
       */
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        if (!sessionId) {
          return new Response(
            JSON.stringify({
              error: 'sessionId query parameter is required',
              code: 'MISSING_SESSION_ID',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        let services;
        try {
          services = getApiServicesOrThrow();
        } catch (error) {
          console.error('[Task Creation SSE] Services not available:', error);
          return new Response(
            JSON.stringify({
              error: 'Streaming is not available',
              code: 'STREAMING_NOT_CONFIGURED',
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Verify session exists
        const session = services.taskCreationService.getSession(sessionId);
        if (!session) {
          return new Response(
            JSON.stringify({
              error: 'Session not found',
              code: 'SESSION_NOT_FOUND',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const stream = services.durableStreamsService.subscribe(sessionId);
        const encoder = new TextEncoder();
        let isCancelled = false;

        const readable = new ReadableStream({
          async start(controller) {
            try {
              // Send initial connection event
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`
                )
              );

              for await (const event of stream) {
                if (isCancelled) break;

                // Only forward task-creation related events
                if (event.type.startsWith('task-creation:')) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                }
              }
              controller.close();
            } catch (error) {
              console.error(`[Task Creation SSE] Stream error for session ${sessionId}:`, error);

              const errorEvent = {
                type: 'error',
                data: {
                  message: 'An error occurred while streaming task creation data',
                },
                timestamp: Date.now(),
              };
              controller.enqueue(
                encoder.encode(`event: error\ndata: ${JSON.stringify(errorEvent)}\n\n`)
              );
              controller.close();
            }
          },
          cancel() {
            isCancelled = true;
          },
        });

        return new Response(readable, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
          },
        });
      },
    },
  },
});
