import { createRuntimeContext } from '@/app/services/runtime';
import { pglite } from '@/db/client';
import { getStreamProvider, hasStreamProvider } from '@/lib/streams/provider';

export function getApiRuntime() {
  return createRuntimeContext({
    db: pglite,
    streams: hasStreamProvider() ? getStreamProvider() : undefined,
  });
}
