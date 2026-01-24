import { createFileRoute } from '@tanstack/react-router';
import { forbiddenResponse, validateUserIdMatch, withAuth } from '@/lib/api/auth-middleware';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';

export const Route = createFileRoute('/api/streams/')({
  server: {
    handlers: {
      /**
       * GET /api/streams - List all active streams (admin endpoint)
       */
      GET: async () => {
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

        // This endpoint is primarily for debugging/admin purposes
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              status: 'active',
              message: 'Durable streams server is running',
            },
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      },

      /**
       * POST /api/streams?sessionId=xxx - Write to a session stream
       *
       * Body: { channel: string, data: object }
       * Response: { ok: true, offset: number }
       */
      POST: withAuth(async ({ request, auth }) => {
        const url = new URL(request.url);
        const sessionId = url.searchParams.get('sessionId');

        // Validate session ID
        if (!sessionId) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'MISSING_SESSION_ID',
                message: 'sessionId query parameter is required',
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Validate session ID format
        if (!/^[a-zA-Z0-9_-]+$/.test(sessionId) || sessionId.length > 100) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'INVALID_SESSION_ID', message: 'Invalid session ID format' },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Parse request body
        let body: { channel?: string; data?: unknown };
        try {
          body = await request.json();
        } catch {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Validate channel
        const { channel, data } = body;
        const validChannels = [
          'terminal',
          'presence',
          'workflow',
          'chunks',
          'toolCalls',
          'agentState',
        ];

        if (!channel || !validChannels.includes(channel)) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'INVALID_CHANNEL',
                message: `channel must be one of: ${validChannels.join(', ')}`,
              },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // Validate data
        if (!data || typeof data !== 'object') {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'INVALID_DATA', message: 'data must be an object' },
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        // For presence events, validate userId matches authenticated user
        if (channel === 'presence') {
          const presenceData = data as { userId?: string };
          if (presenceData.userId && !validateUserIdMatch(presenceData.userId, auth.userId)) {
            return forbiddenResponse('Cannot send presence for another user');
          }
        }

        // Check if stream provider is available
        if (!hasStreamProvider()) {
          return new Response(
            JSON.stringify({
              ok: false,
              error: { code: 'STREAM_UNAVAILABLE', message: 'Stream provider not configured' },
            }),
            { status: 503, headers: { 'Content-Type': 'application/json' } }
          );
        }

        try {
          const provider = getStreamProvider();

          // Map channel to event type
          const eventType = mapChannelToEventType(channel, data);

          // Publish to the stream and get the actual offset
          const offset = await provider.publish(sessionId, eventType, data);

          return new Response(JSON.stringify({ ok: true, offset }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error(
            '[/api/streams] Error publishing:',
            error instanceof Error ? error.message : String(error)
          );

          return new Response(
            JSON.stringify({
              ok: false,
              error: {
                code: 'PUBLISH_FAILED',
                message: error instanceof Error ? error.message : 'Failed to publish event',
              },
            }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }),
    },
  },
});

/**
 * Map channel name to event type string
 */
function mapChannelToEventType(channel: string, data: unknown): string {
  switch (channel) {
    case 'terminal': {
      const terminalData = data as { type?: string };
      return terminalData.type === 'input' ? 'terminal:input' : 'terminal:output';
    }
    case 'presence':
      return 'presence:cursor';
    case 'workflow':
      return 'workflow';
    case 'chunks':
      return 'chunk';
    case 'toolCalls': {
      const toolData = data as { status?: string };
      return toolData.status === 'running' ? 'tool:start' : 'tool:result';
    }
    case 'agentState':
      return 'state:update';
    default:
      return channel;
  }
}
