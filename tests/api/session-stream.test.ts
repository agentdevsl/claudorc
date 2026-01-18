import { beforeEach, describe, expect, it, vi } from 'vitest';

const streamProviderMocks = vi.hoisted(() => ({
  hasStreamProvider: vi.fn(),
  getStreamProvider: vi.fn(),
}));

vi.mock('@/db/client', () => ({ pglite: {}, sqlite: {}, db: {} }));
vi.mock('@/lib/streams/provider', () => ({
  hasStreamProvider: streamProviderMocks.hasStreamProvider,
  getStreamProvider: streamProviderMocks.getStreamProvider,
}));

import { Route as SessionStreamRoute } from '@/app/routes/api/sessions/$id/stream';

describe('Session stream API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 503 when streaming is not configured', async () => {
    streamProviderMocks.hasStreamProvider.mockReturnValue(false);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await SessionStreamRoute.options.server?.handlers?.GET({
      params: { id: 'session-1' },
    });

    consoleSpy.mockRestore();

    expect(response?.status).toBe(503);
    const body = (await response?.json()) as { error: string; code: string };
    expect(body.code).toBe('STREAMING_NOT_CONFIGURED');
  });
});
