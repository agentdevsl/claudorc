import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntimeOrThrow, getApiStreamsOrThrow } from '@/app/routes/api/runtime';
import { SessionService } from '@/services/session.service';

const getSessionService = (): SessionService => {
  const runtime = getApiRuntimeOrThrow();
  return new SessionService(runtime.db, getApiStreamsOrThrow(), {
    baseUrl: process.env.APP_URL ?? 'http://localhost:5173',
  });
};

export const Route = createFileRoute('/api/sessions/$id/stream')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { id: string } }) => {
        const sessionId = params.id;

        // Check if streaming is configured before proceeding
        let sessionService: SessionService;
        try {
          sessionService = getSessionService();
        } catch (error) {
          console.error('[SSE] Stream provider not configured:', error);
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

        const stream = sessionService.subscribe(sessionId);
        const encoder = new TextEncoder();
        let isCancelled = false;

        const readable = new ReadableStream({
          async start(controller) {
            try {
              for await (const event of stream) {
                if (isCancelled) break;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
              controller.close();
            } catch (error) {
              // Log full error on server for debugging
              console.error(`[SSE] Stream error for session ${sessionId}:`, error);

              // Send generic error to client - never expose internal error messages
              const errorEvent = {
                type: 'error',
                data: {
                  message: 'An error occurred while streaming session data',
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
