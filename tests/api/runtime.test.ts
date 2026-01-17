import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DurableStreamsServer } from '@/services/session.service';

const streamProviderMocks = vi.hoisted(() => ({
  hasStreamProvider: vi.fn(),
  getStreamProvider: vi.fn(),
}));

vi.mock('@/db/client', () => ({ pglite: {}, db: {} }));
vi.mock('@/lib/streams/provider', () => ({
  hasStreamProvider: streamProviderMocks.hasStreamProvider,
  getStreamProvider: streamProviderMocks.getStreamProvider,
}));

import { getApiStreamsOrThrow } from '@/app/routes/api/runtime';

describe('API runtime streams', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when stream provider is missing', () => {
    streamProviderMocks.hasStreamProvider.mockReturnValue(false);

    expect(() => getApiStreamsOrThrow()).toThrow('Stream provider not configured');
  });

  it('returns the stream provider when configured', () => {
    const provider: DurableStreamsServer = {
      createStream: vi.fn(async () => undefined),
      publish: vi.fn(async () => undefined),
      subscribe: async function* () {
        yield { type: 'chunk', data: {} };
      },
    };

    streamProviderMocks.hasStreamProvider.mockReturnValue(true);
    streamProviderMocks.getStreamProvider.mockReturnValue(provider);

    expect(getApiStreamsOrThrow()).toBe(provider);
  });
});
