import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DurableStreamsServer } from '../../../services/session.service.js';

// We need to reset the module state between tests since it uses module-level state
let setStreamProvider: typeof import('../provider.js').setStreamProvider;
let getStreamProvider: typeof import('../provider.js').getStreamProvider;
let hasStreamProvider: typeof import('../provider.js').hasStreamProvider;

describe('streams provider', () => {
  beforeEach(async () => {
    // Reset module state by re-importing
    vi.resetModules();
    const module = await import('../provider.js');
    setStreamProvider = module.setStreamProvider;
    getStreamProvider = module.getStreamProvider;
    hasStreamProvider = module.hasStreamProvider;
  });

  describe('hasStreamProvider', () => {
    it('returns false when no provider is set', () => {
      expect(hasStreamProvider()).toBe(false);
    });

    it('returns true after provider is set', () => {
      const mockProvider = createMockProvider();

      setStreamProvider(mockProvider);

      expect(hasStreamProvider()).toBe(true);
    });
  });

  describe('setStreamProvider', () => {
    it('sets the stream provider', () => {
      const mockProvider = createMockProvider();

      setStreamProvider(mockProvider);

      expect(hasStreamProvider()).toBe(true);
      expect(getStreamProvider()).toBe(mockProvider);
    });

    it('allows replacing the provider', () => {
      const firstProvider = createMockProvider();
      const secondProvider = createMockProvider();

      setStreamProvider(firstProvider);
      setStreamProvider(secondProvider);

      expect(getStreamProvider()).toBe(secondProvider);
      expect(getStreamProvider()).not.toBe(firstProvider);
    });
  });

  describe('getStreamProvider', () => {
    it('throws when no provider is configured', () => {
      expect(() => getStreamProvider()).toThrow('Stream provider not configured');
    });

    it('returns the configured provider', () => {
      const mockProvider = createMockProvider();

      setStreamProvider(mockProvider);

      expect(getStreamProvider()).toBe(mockProvider);
    });

    it('returns the same provider instance on multiple calls', () => {
      const mockProvider = createMockProvider();

      setStreamProvider(mockProvider);

      const first = getStreamProvider();
      const second = getStreamProvider();

      expect(first).toBe(second);
      expect(first).toBe(mockProvider);
    });
  });

  describe('provider interface', () => {
    it('preserves all methods of the provider', () => {
      const mockProvider = createMockProvider();

      setStreamProvider(mockProvider);
      const provider = getStreamProvider();

      expect(typeof provider.createStream).toBe('function');
      expect(typeof provider.publish).toBe('function');
      expect(typeof provider.subscribe).toBe('function');
    });

    it('allows calling provider methods after retrieval', async () => {
      const mockProvider = createMockProvider();
      mockProvider.createStream = vi.fn().mockResolvedValue(undefined);
      mockProvider.publish = vi.fn().mockResolvedValue(undefined);

      setStreamProvider(mockProvider);
      const provider = getStreamProvider();

      await provider.createStream('stream-1', { type: 'test' });
      await provider.publish('stream-1', 'event', { data: 'test' });

      expect(mockProvider.createStream).toHaveBeenCalledWith('stream-1', { type: 'test' });
      expect(mockProvider.publish).toHaveBeenCalledWith('stream-1', 'event', { data: 'test' });
    });
  });
});

function createMockProvider(): DurableStreamsServer {
  return {
    createStream: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockImplementation(function* () {
      // Empty async generator
    }),
  };
}
