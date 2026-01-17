import type { DurableStreamsServer } from '@/services/session.service';

/**
 * Stream provider for real-time session events.
 *
 * In production, this should be configured with a real DurableStreams client.
 * When not configured, operations will fail explicitly rather than silently.
 */

let configuredProvider: DurableStreamsServer | null = null;

/**
 * Configure the global stream provider.
 * Should be called during application bootstrap.
 */
export function configureStreamProvider(provider: DurableStreamsServer): void {
  configuredProvider = provider;
}

/**
 * Get the configured stream provider.
 * Throws if no provider has been configured.
 */
export function getStreamProvider(): DurableStreamsServer {
  if (!configuredProvider) {
    throw new Error(
      'Stream provider not configured. Call configureStreamProvider() during bootstrap.'
    );
  }
  return configuredProvider;
}

/**
 * Check if a stream provider has been configured.
 */
export function hasStreamProvider(): boolean {
  return configuredProvider !== null;
}

/**
 * Create a stub provider for development/testing.
 * Unlike silent stubs, this one logs warnings when used.
 */
export function createDevStreamProvider(): DurableStreamsServer {
  return {
    createStream: (id: string): Promise<void> => {
      console.warn(`[StreamProvider] DEV: createStream called for ${id} - no-op`);
      return Promise.resolve();
    },
    publish: (id: string, type: string): Promise<void> => {
      console.warn(`[StreamProvider] DEV: publish called for ${id}/${type} - no-op`);
      return Promise.resolve();
    },
    subscribe: function* (id: string): Generator<{ type: string; data: unknown }> {
      console.warn(`[StreamProvider] DEV: subscribe called for ${id} - yielding empty stream`);
      // Empty generator - stream ends immediately
      return;
    },
  };
}
