import { createFileRoute } from '@tanstack/react-router';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';
import type { InMemoryDurableStreamsServer } from '@/lib/streams/server';

export const Route = createFileRoute('/api/streams/$streamId')({
  server: {
    handlers: {
      /**
       * GET /api/streams/:streamId - Get stream metadata and events with offset support
       *
       * Query params:
       * - fromOffset: Start reading from this offset (default: 0)
       * - limit: Maximum events to return (default: 100)
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
        const url = new URL(request.url);
        const fromOffset = Number.parseInt(url.searchParams.get('fromOffset') ?? '0', 10);
        const limit = Number.parseInt(url.searchParams.get('limit') ?? '100', 10);

        const metadata = server.getStreamMetadata(streamId);
        if (!metadata) {
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

        const events = server.getEvents(streamId, { fromOffset, limit });

        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              streamId,
              metadata: {
                eventCount: metadata.eventCount,
                createdAt: metadata.createdAt,
              },
              events,
              pagination: {
                fromOffset,
                limit,
                hasMore: fromOffset + events.length < metadata.eventCount,
                nextOffset: fromOffset + events.length,
              },
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },

      /**
       * HEAD /api/streams/:streamId - Get stream metadata only (for checking offset)
       */
      HEAD: async ({ params }: { params: { streamId: string } }) => {
        const streamId = params.streamId;

        if (!hasStreamProvider()) {
          return new Response(null, { status: 503 });
        }

        const server = getStreamProvider() as InMemoryDurableStreamsServer;
        const metadata = server.getStreamMetadata(streamId);

        if (!metadata) {
          return new Response(null, { status: 404 });
        }

        return new Response(null, {
          status: 200,
          headers: {
            'X-Stream-Event-Count': String(metadata.eventCount),
            'X-Stream-Created-At': String(metadata.createdAt),
          },
        });
      },
    },
  },
});
