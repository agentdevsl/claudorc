import type { DurableStreamsServer } from '../../services/session.service.js';

let streamProvider: DurableStreamsServer | null = null;

export function setStreamProvider(provider: DurableStreamsServer): void {
  streamProvider = provider;
}

export function getStreamProvider(): DurableStreamsServer {
  if (!streamProvider) {
    throw new Error('Stream provider not configured');
  }
  return streamProvider;
}

export function hasStreamProvider(): boolean {
  return streamProvider !== null;
}
