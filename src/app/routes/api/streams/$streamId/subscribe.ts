import { createFileRoute } from '@tanstack/react-router';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';
import type { InMemoryDurableStreamsServer } from '@/lib/streams/server';

export const Route = createFileRoute('/api/streams/$streamId/subscribe')({
  server: {
    handlers: {
      /**
       * GET /api/streams/:streamId/subscribe - SSE endpoint for real-time stream events
       *
       * Query params:
       * - fromOffset: Start reading from this offset for resumability (default: 0)
       *
       * This endpoint supports offset-based resumability:
       * 1. Client can specify fromOffset to resume from a specific point
       * 2. Each event includes its offset in the data
       * 3. On disconnect, client can reconnect with last-known offset
       */
      GET: async ({ params, request }: { params: { streamId: string }; request: Request }) => {
        const streamId = params.streamId;

        if (!hasStreamProvider()) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'STREAMS_NOT_CONFIGURED', message: 'Streams not configured' },
            }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        const server = getStreamProvider() as InMemoryDurableStreamsServer;

        // Check if stream exists
        if (!server.hasStream(streamId)) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'STREAM_NOT_FOUND', message: `Stream ${streamId} not found` },
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            }
          );
        }

        // Parse fromOffset for resumability
        const url = new URL(request.url);
        const fromOffset = Number.parseInt(url.searchParams.get('fromOffset') ?? '0', 10);

        const encoder = new TextEncoder();
        let isCancelled = false;

        const readable = new ReadableStream({
          async start(controller) {
            try {
              // Send initial connection event with current offset info
              const currentOffset = server.getCurrentOffset(streamId);
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    type: 'connected',
                    streamId,
                    currentOffset,
                    resumedFromOffset: fromOffset,
                  })}\n\n`
                )
              );

              // Subscribe to the stream with offset-based resumability
              const subscription = server.subscribe(streamId, { fromOffset });

              for await (const event of subscription) {
                if (isCancelled) break;

                // Send event with offset for client tracking
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      ...event,
                      offset: event.offset,
                      timestamp: Date.now(),
                    })}\n\n`
                  )
                );
              }

              controller.close();
            } catch (error) {
              console.error(`[Streams SSE] Stream error for ${streamId}:`, error);

              const errorEvent = {
                type: 'error',
                error: {
                  code: 'STREAM_ERROR',
                  message: 'An error occurred while streaming',
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
            'X-Stream-Id': streamId,
          },
        });
      },
    },
  },
});
