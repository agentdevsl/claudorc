import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentPaneClient } from '../agentpane-client.js';

// Mock fetch globally
const mockFetch = vi.fn();
const _originalFetch = globalThis.fetch;
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('AgentPaneClient', () => {
  let client: AgentPaneClient;

  beforeEach(() => {
    client = new AgentPaneClient(3001);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    mockFetch.mockReset();
  });

  describe('basic operations', () => {
    it('registers successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.register({
        daemonId: 'dm_test',
        pid: 123,
        version: '0.1.0',
        watchPath: '/tmp',
        capabilities: [],
        startedAt: Date.now(),
      });

      expect(mockFetch).toHaveBeenCalledOnce();
      expect(mockFetch.mock.calls[0][0]).toBe('http://localhost:3001/api/cli-monitor/register');
    });

    it('throws on failed registration', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(
        client.register({
          daemonId: 'dm_test',
          pid: 123,
          version: '0.1.0',
          watchPath: '/tmp',
          capabilities: [],
          startedAt: Date.now(),
        })
      ).rejects.toThrow('Registration failed');
    });

    it('sends heartbeat successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.heartbeat('dm_test', 5);

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('sends ingest successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.ingest('dm_test', [], []);

      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('deregisters successfully', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await client.deregister('dm_test');

      expect(mockFetch).toHaveBeenCalledOnce();
    });
  });

  describe('circuit breaker', () => {
    it('starts in closed state', () => {
      expect(client.getCircuitState()).toBe('closed');
    });

    it('opens after 5 consecutive failures', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      // 5 failures should trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();
      }

      expect(client.getCircuitState()).toBe('open');
    });

    it('blocks requests when circuit is open', async () => {
      mockFetch.mockRejectedValue(new Error('connection refused'));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();
      }

      expect(client.getCircuitState()).toBe('open');

      // Next request should be blocked without calling fetch
      mockFetch.mockClear();
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow('Circuit breaker is open');
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('resets to closed on successful request', async () => {
      // First make a few failures (not enough to trip)
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();

      mockFetch.mockRejectedValueOnce(new Error('fail'));
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();

      // Success resets the counter
      mockFetch.mockResolvedValueOnce({ ok: true });
      await client.heartbeat('dm_test', 0);

      expect(client.getCircuitState()).toBe('closed');

      // Now 2 more failures should not trip (counter was reset)
      mockFetch.mockRejectedValueOnce(new Error('fail'));
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();

      mockFetch.mockRejectedValueOnce(new Error('fail'));
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();

      expect(client.getCircuitState()).toBe('closed');
    });

    it('transitions to half-open after timeout', async () => {
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new Error('connection refused'));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();
      }
      expect(client.getCircuitState()).toBe('open');

      // Advance past 60s timeout
      vi.advanceTimersByTime(61_000);

      // Next request should go through (half-open allows one attempt)
      mockFetch.mockResolvedValueOnce({ ok: true });
      await client.heartbeat('dm_test', 0);

      expect(client.getCircuitState()).toBe('closed');

      vi.useRealTimers();
    });

    it('re-opens if half-open attempt fails', async () => {
      vi.useFakeTimers();

      mockFetch.mockRejectedValue(new Error('connection refused'));

      // Trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();
      }
      expect(client.getCircuitState()).toBe('open');

      // Advance past timeout
      vi.advanceTimersByTime(61_000);

      // Half-open attempt fails
      mockFetch.mockRejectedValueOnce(new Error('still down'));
      await expect(client.heartbeat('dm_test', 0)).rejects.toThrow();

      // Should be open again (failure count hit threshold again from half-open)
      expect(client.getCircuitState()).toBe('open');

      vi.useRealTimers();
    });
  });
});
