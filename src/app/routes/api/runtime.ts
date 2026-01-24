import { drizzle } from 'drizzle-orm/better-sqlite3';
import { createRuntimeContext, type RuntimeContext } from '@/app/services/runtime';
import { createServices, type Services } from '@/app/services/services';
import { sqlite } from '@/db/client';
import * as schema from '@/db/schema/index.js';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';
import type { DurableStreamsServer } from '@/services/session.service';

export type { Services };

const fallbackStreams: DurableStreamsServer = {
  createStream: async () => undefined,
  publish: async () => 1, // Returns offset
  subscribe: async function* () {
    yield { type: 'chunk', data: {}, offset: 0 };
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
    db: sqlite ?? undefined,
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
  if (!sqlite) {
    return {
      ok: false as const,
      error: { code: 'DB_MISSING', message: 'Database not available', status: 500 },
    };
  }
  const db = drizzle(sqlite, { schema });
  return createServices({
    db,
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
