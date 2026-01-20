import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_ERROR_CODES } from '@/lib/api/client';

// We need to test the internal apiFetch function behavior
// Since it's not exported, we test through the apiClient methods

describe('API Client Error Handling', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('REQUEST_ABORTED error', () => {
    it('returns REQUEST_ABORTED when AbortController signals abort', async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';

      global.fetch = vi.fn().mockRejectedValue(abortError);

      // Import fresh to get the mocked fetch
      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.REQUEST_ABORTED);
        expect(result.error.message).toBe('Request was aborted');
      }
    });
  });

  describe('NETWORK_ERROR error', () => {
    it('returns NETWORK_ERROR for TypeError (network failures)', async () => {
      const networkError = new TypeError('Failed to fetch');

      global.fetch = vi.fn().mockRejectedValue(networkError);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.NETWORK_ERROR);
        expect(result.error.message).toBe('Failed to fetch');
      }
    });

    it('returns NETWORK_ERROR with default message when TypeError has no message', async () => {
      const networkError = new TypeError();

      global.fetch = vi.fn().mockRejectedValue(networkError);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.NETWORK_ERROR);
        expect(result.error.message).toBe('Network request failed');
      }
    });
  });

  describe('FETCH_ERROR error', () => {
    it('returns FETCH_ERROR for generic errors', async () => {
      const genericError = new Error('Something went wrong');

      global.fetch = vi.fn().mockRejectedValue(genericError);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.FETCH_ERROR);
        expect(result.error.message).toBe('Something went wrong');
      }
    });

    it('returns FETCH_ERROR with default message for non-Error objects', async () => {
      global.fetch = vi.fn().mockRejectedValue('string error');

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.FETCH_ERROR);
        expect(result.error.message).toBe('Network request failed');
      }
    });
  });

  describe('PARSE_ERROR error', () => {
    it('returns PARSE_ERROR when response is not valid JSON', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token')),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.PARSE_ERROR);
        expect(result.error.message).toContain('Invalid JSON response (HTTP 200)');
        expect(result.error.message).toContain('Unexpected token');
      }
    });

    it('returns PARSE_ERROR with HTTP status for 502 error pages', async () => {
      const mockResponse = {
        ok: false,
        status: 502,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token <')),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(API_ERROR_CODES.PARSE_ERROR);
        expect(result.error.message).toContain('HTTP 502');
      }
    });
  });

  describe('Successful responses', () => {
    it('returns successful response when fetch and parse succeed', async () => {
      const mockData = {
        ok: true,
        data: {
          items: [{ id: '1', name: 'Project 1', path: '/path' }],
          totalCount: 1,
          hasMore: false,
          nextCursor: null,
        },
      };

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
      };

      global.fetch = vi.fn().mockResolvedValue(mockResponse);

      const { apiClient } = await import('@/lib/api/client');
      const result = await apiClient.projects.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.items).toHaveLength(1);
      }
    });
  });

  describe('API_ERROR_CODES constants', () => {
    it('exports all expected error codes', () => {
      expect(API_ERROR_CODES.REQUEST_ABORTED).toBe('REQUEST_ABORTED');
      expect(API_ERROR_CODES.NETWORK_ERROR).toBe('NETWORK_ERROR');
      expect(API_ERROR_CODES.FETCH_ERROR).toBe('FETCH_ERROR');
      expect(API_ERROR_CODES.PARSE_ERROR).toBe('PARSE_ERROR');
      expect(API_ERROR_CODES.SERVER_ERROR).toBe('SERVER_ERROR');
    });
  });
});
