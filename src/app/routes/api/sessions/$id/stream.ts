import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { SessionService } from '@/services/session.service';

const sessionService = new SessionService(
  db,
  {
    createStream: async () => undefined,
    publish: async () => undefined,
    subscribe: async function* () {
      yield { type: 'chunk', data: {} };
    },
  },
  { baseUrl: process.env.APP_URL ?? 'http://localhost:5173' }
);

export const Route = createFileRoute('/api/sessions/$id/stream')({
  server: {
    handlers: {
      GET: async (_request, { params }) => {
        const sessionId = params.id;
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
              // Send error event to client before closing
              const errorEvent = {
                type: 'error',
                data: { message: String(error) },
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
