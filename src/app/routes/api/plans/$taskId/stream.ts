import { createFileRoute } from '@tanstack/react-router';
import type { Services } from '@/app/routes/api/runtime';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';

export const Route = createFileRoute('/api/plans/$taskId/stream')({
  server: {
    handlers: {
      /**
       * GET /api/plans/:taskId/stream - SSE stream for plan session events
       */
      GET: async ({ params }: { params: { taskId: string } }) => {
        const taskId = params.taskId;

        let services: Services;
        try {
          services = getApiServicesOrThrow();
        } catch (error) {
          console.error('[Plans SSE] Services not available:', error);
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

        // Get the plan session for this task to find the stream ID
        const sessionResult = await services.planModeService.getByTaskId(taskId);

        if (!sessionResult.ok || !sessionResult.value) {
          return new Response(
            JSON.stringify({
              error: 'No plan session found for this task',
              code: 'SESSION_NOT_FOUND',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const sessionId = sessionResult.value.id;
        const stream = services.durableStreamsService.subscribe(sessionId);
        const encoder = new TextEncoder();
        let isCancelled = false;

        const readable = new ReadableStream({
          async start(controller) {
            try {
              // Send initial connection event
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`)
              );

              for await (const event of stream) {
                if (isCancelled) break;

                // Only forward plan-related events
                if (event.type.startsWith('plan:')) {
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                }
              }
              controller.close();
            } catch (error) {
              console.error(`[Plans SSE] Stream error for task ${taskId}:`, error);

              const errorEvent = {
                type: 'error',
                data: {
                  message: 'An error occurred while streaming plan data',
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
