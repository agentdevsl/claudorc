import { createRuntimeContext, type RuntimeContext } from '@/app/services/runtime';
import { createServices, type Services } from '@/app/services/services';
import { pglite } from '@/db/client';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';
import type { DurableStreamsServer } from '@/services/session.service';

const fallbackStreams: DurableStreamsServer = {
  createStream: async () => undefined,
  publish: async () => undefined,
  subscribe: async function* () {
    yield { type: 'chunk', data: {} };
  },
};

const getApiStreams = (): DurableStreamsServer =>
  hasStreamProvider() ? getStreamProvider() : fallbackStreams;

export function getApiStreamsOrThrow(): DurableStreamsServer {
  if (!hasStreamProvider()) {
    throw new Error('Stream provider not configured');
  }
  return getStreamProvider();
}

export function getApiRuntime() {
  return createRuntimeContext({
    db: pglite,
    streams: getApiStreams(),
  });
}

export function getApiRuntimeOrThrow(): RuntimeContext {
  const runtime = getApiRuntime();
  if (!runtime.ok) {
    throw new Error(runtime.error.message);
  }
  return runtime.value;
}

export function getApiServices() {
  return createServices({
    db: pglite,
    streams: getApiStreams(),
  });
}

export function getApiServicesOrThrow(): Services {
  const services = getApiServices();
  if (!services.ok) {
    throw new Error(services.error.message);
  }
  return services.value;
}
