import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';

export const connectStreams = async () => {
  try {
    const { DurableStreamsClient } = await import('@durable-streams/client');
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
