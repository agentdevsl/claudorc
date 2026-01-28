import { getStreamProvider } from '../lib/streams/provider.js';
import type { DurableStreamsServer } from '../services/session.service.js';

export function getApiStreamsOrThrow(): DurableStreamsServer {
  return getStreamProvider();
}
