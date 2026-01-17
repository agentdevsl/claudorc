import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';

type DurableStreamsClientConstructor = new (config: {
  url: string;
  reconnect: Record<string, unknown>;
}) => {
  connect: () => Promise<void>;
};

const resolveStreamsClient = async (): Promise<DurableStreamsClientConstructor | undefined> => {
  if (globalThis.DurableStreamsClient) {
    return globalThis.DurableStreamsClient;
  }

  try {
    const module = await import('@durable-streams/client');
    return (module as { DurableStreamsClient?: DurableStreamsClientConstructor }).DurableStreamsClient;
  } catch {
    return undefined;
  }
};

export const connectStreams = async () => {
  try {
    const DurableStreamsClient = await resolveStreamsClient();
    if (!DurableStreamsClient) {
      return err(
        createError('BOOTSTRAP_STREAMS_FAILED', 'DurableStreamsClient not available', 500)
      );
    }
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
    | (new (config: {
        url: string;
        reconnect: Record<string, unknown>;
      }) => {
        connect: () => Promise<void>;
      })
    | undefined;
}
