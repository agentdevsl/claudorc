import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DurableStreamsServer } from '../../src/services/session.service.js';

const streamProviderMocks = vi.hoisted(() => ({
  hasStreamProvider: vi.fn(),
  getStreamProvider: vi.fn(),
}));

vi.mock('../../src/db/client.js', () => ({ pglite: {}, sqlite: {}, db: {} }));
vi.mock('../../src/lib/streams/provider.js', () => ({
  hasStreamProvider: streamProviderMocks.hasStreamProvider,
  getStreamProvider: streamProviderMocks.getStreamProvider,
}));

import { getApiStreamsOrThrow } from '../../src/server/runtime.js';

describe('API runtime streams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when stream provider is missing', () => {
    streamProviderMocks.getStreamProvider.mockImplementation(() => {
      throw new Error('Stream provider not configured');
    });

    expect(() => getApiStreamsOrThrow()).toThrow('Stream provider not configured');
  });

  it('returns the stream provider when configured', () => {
    const provider: DurableStreamsServer = {
      createStream: vi.fn(async () => undefined),
      publish: vi.fn(async () => 1),
      subscribe: async function* () {
        yield { type: 'chunk', data: {}, offset: 0 };
      },
    };

    streamProviderMocks.hasStreamProvider.mockReturnValue(true);
    streamProviderMocks.getStreamProvider.mockReturnValue(provider);

    expect(getApiStreamsOrThrow()).toBe(provider);
  });
});
