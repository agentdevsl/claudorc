import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';

const resolveStreamsClient = async () => {
  if (globalThis.DurableStreamsClient) {
    return { DurableStreamsClient: globalThis.DurableStreamsClient };
  }

  return import('@durable-streams/client');
};

export const connectStreams = async () => {
  try {
    const { DurableStreamsClient } = await resolveStreamsClient();
    const client = new DurableStreamsClient({
      url: '/api/streams',
      reconnect: {
        maxAttempts: 5,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffFactor: 2,
      },
    });

    await client.connect();

    return ok(client);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_STREAMS_FAILED', 'Failed to connect streams', 500, {
        error: String(error),
      })
    );
  }
};

declare global {
  var DurableStreamsClient:
    | (new (config: { url: string; reconnect: Record<string, unknown> }) => {
        connect: () => Promise<void>;
      })
    | undefined;
}
