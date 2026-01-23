/**
 * Tests for SSE Token Service
 *
 * Comprehensive test coverage for the SSE token authentication system including:
 * - Token generation
 * - Token validation and consumption
 * - Token expiration handling
 * - Token revocation
 * - Concurrent token handling
 * - Error cases and edge cases
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SSETokenService } from '../../src/server/sse-token.service';

describe('SSETokenService', () => {
  let service: SSETokenService;

  beforeEach(() => {
    service = new SSETokenService();
  });

  afterEach(() => {
    service.stopCleanup();
    service.clear();
  });

  // =============================================================================
  // Token Generation Tests
  // =============================================================================

  describe('generate', () => {
    it('generates a valid SSE token with default options', () => {
      const result = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.token).toMatch(/^sse_[a-f0-9]{64}$/);
        expect(result.value.userId).toBe('user-123');
        expect(result.value.streamId).toBe('stream-456');
        expect(result.value.scopes).toEqual(['stream:read']);
        expect(result.value.used).toBe(false);
        expect(result.value.expiresAt).toBeGreaterThan(Date.now());
        expect(result.value.id).toBeDefined();
        expect(result.value.createdAt).toBeDefined();
      }
    });

    it('generates a token with custom scopes', () => {
      const result = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        scopes: ['stream:read', 'stream:write', 'events:subscribe'],
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.scopes).toEqual(['stream:read', 'stream:write', 'events:subscribe']);
      }
    });

    it('generates a token with custom expiry time', () => {
      const customExpiryMs = 60 * 1000; // 1 minute
      const beforeGenerate = Date.now();

      const result = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        expiryMs: customExpiryMs,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Expiry should be approximately 1 minute from now
        const expectedExpiry = beforeGenerate + customExpiryMs;
        expect(result.value.expiresAt).toBeGreaterThanOrEqual(expectedExpiry);
        expect(result.value.expiresAt).toBeLessThan(expectedExpiry + 1000); // Allow 1s tolerance
      }
    });

    it('generates unique tokens for each call', () => {
      const tokens = new Set<string>();

      // Use different users to avoid max tokens per user limit
      for (let i = 0; i < 50; i++) {
        const result = service.generate({
          userId: `user-${i}`,
          streamId: 'stream-456',
        });
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(tokens.has(result.value.token)).toBe(false);
          tokens.add(result.value.token);
        }
      }

      expect(tokens.size).toBe(50);
    });

    it('fails when max tokens per user is exceeded', () => {
      // Generate maximum allowed tokens
      for (let i = 0; i < 10; i++) {
        const result = service.generate({
          userId: 'user-123',
          streamId: `stream-${i}`,
        });
        expect(result.ok).toBe(true);
      }

      // Next token should fail
      const result = service.generate({
        userId: 'user-123',
        streamId: 'stream-overflow',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MAX_TOKENS_EXCEEDED');
      }
    });

    it('allows token generation after cleanup of expired tokens', async () => {
      // Generate tokens with very short expiry
      for (let i = 0; i < 10; i++) {
        const result = service.generate({
          userId: 'user-123',
          streamId: `stream-${i}`,
          expiryMs: 10, // 10ms expiry
        });
        expect(result.ok).toBe(true);
      }

      // Wait for tokens to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should succeed now because expired tokens are cleaned up
      const result = service.generate({
        userId: 'user-123',
        streamId: 'stream-new',
      });

      expect(result.ok).toBe(true);
    });
  });

  // =============================================================================
  // Token Validation Tests
  // =============================================================================

  describe('validate', () => {
    it('validates a valid unused token successfully', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        scopes: ['stream:read', 'events:subscribe'],
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      const validateResult = service.validate(generateResult.value.token);

      expect(validateResult.ok).toBe(true);
      if (validateResult.ok) {
        expect(validateResult.value.userId).toBe('user-123');
        expect(validateResult.value.streamId).toBe('stream-456');
        expect(validateResult.value.scopes).toEqual(['stream:read', 'events:subscribe']);
      }
    });

    it('marks token as used after validation', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      // First validation should succeed
      const firstValidation = service.validate(generateResult.value.token);
      expect(firstValidation.ok).toBe(true);

      // Second validation should fail - token already used
      const secondValidation = service.validate(generateResult.value.token);
      expect(secondValidation.ok).toBe(false);
      if (!secondValidation.ok) {
        expect(secondValidation.error.code).toBe('TOKEN_ALREADY_USED');
      }
    });

    it('fails for invalid token format - empty string', () => {
      const result = service.validate('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('fails for invalid token format - wrong prefix', () => {
      const result = service.validate(`xyz_${'a'.repeat(64)}`);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('fails for invalid token format - wrong length', () => {
      const result = service.validate('sse_abc123');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_TOKEN');
      }
    });

    it('fails for token not found', () => {
      // Valid format but not generated
      const fakeToken = `sse_${'a'.repeat(64)}`;
      const result = service.validate(fakeToken);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TOKEN_NOT_FOUND');
      }
    });
  });

  // =============================================================================
  // Token Expiration Tests
  // =============================================================================

  describe('expiration', () => {
    it('fails validation for expired token', async () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        expiryMs: 10, // 10ms expiry
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      // Wait for token to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      const validateResult = service.validate(generateResult.value.token);

      expect(validateResult.ok).toBe(false);
      if (!validateResult.ok) {
        expect(validateResult.error.code).toBe('TOKEN_EXPIRED');
      }
    });

    it('removes expired token after failed validation', async () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        expiryMs: 10,
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      await new Promise((resolve) => setTimeout(resolve, 50));

      // First validation - TOKEN_EXPIRED
      service.validate(generateResult.value.token);

      // Second validation - TOKEN_NOT_FOUND (because it was removed after expiration)
      const result = service.validate(generateResult.value.token);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TOKEN_NOT_FOUND');
      }
    });

    it('cleanup removes expired tokens', async () => {
      // Generate some tokens with short expiry
      for (let i = 0; i < 5; i++) {
        service.generate({
          userId: 'user-123',
          streamId: `stream-${i}`,
          expiryMs: 10,
        });
      }

      // Generate some tokens with normal expiry
      for (let i = 5; i < 8; i++) {
        service.generate({
          userId: 'user-456',
          streamId: `stream-${i}`,
        });
      }

      // Wait for short-expiry tokens to expire
      await new Promise((resolve) => setTimeout(resolve, 50));

      const removed = service.cleanup();

      expect(removed).toBe(5); // 5 expired tokens should be removed
    });
  });

  // =============================================================================
  // Token Revocation Tests
  // =============================================================================

  describe('revoke', () => {
    it('revokes a specific token', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      const revokeResult = service.revoke(generateResult.value.token);
      expect(revokeResult.ok).toBe(true);

      // Token should no longer be valid (removed from storage)
      const validateResult = service.validate(generateResult.value.token);
      expect(validateResult.ok).toBe(false);
      if (!validateResult.ok) {
        expect(validateResult.error.code).toBe('TOKEN_NOT_FOUND');
      }
    });

    it('fails to revoke non-existent token', () => {
      const fakeToken = `sse_${'a'.repeat(64)}`;
      const result = service.revoke(fakeToken);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('TOKEN_NOT_FOUND');
      }
    });

    it('revokes all tokens for a user', () => {
      // Generate tokens for user-123
      const tokens: string[] = [];
      for (let i = 0; i < 5; i++) {
        const result = service.generate({
          userId: 'user-123',
          streamId: `stream-${i}`,
        });
        if (result.ok) {
          tokens.push(result.value.token);
        }
      }

      // Generate tokens for user-456
      const otherUserResult = service.generate({
        userId: 'user-456',
        streamId: 'stream-other',
      });
      expect(otherUserResult.ok).toBe(true);

      // Revoke all tokens for user-123
      const revokeResult = service.revokeAllForUser('user-123');
      expect(revokeResult.ok).toBe(true);
      if (revokeResult.ok) {
        expect(revokeResult.value).toBe(5);
      }

      // All user-123 tokens should be invalid
      for (const token of tokens) {
        const validateResult = service.validate(token);
        expect(validateResult.ok).toBe(false);
      }

      // user-456 token should still be valid
      if (otherUserResult.ok) {
        const validateResult = service.validate(otherUserResult.value.token);
        expect(validateResult.ok).toBe(true);
      }
    });

    it('returns 0 when revoking for user with no tokens', () => {
      const result = service.revokeAllForUser('non-existent-user');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(0);
      }
    });
  });

  // =============================================================================
  // Concurrent Token Handling Tests
  // =============================================================================

  describe('concurrent handling', () => {
    it('handles multiple concurrent token generations', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        Promise.resolve(
          service.generate({
            userId: `user-${i}`,
            streamId: `stream-${i}`,
          })
        )
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result, i) => {
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.userId).toBe(`user-${i}`);
        }
      });

      // All tokens should be unique
      const tokens = new Set(results.filter((r) => r.ok).map((r) => (r as any).value.token));
      expect(tokens.size).toBe(5);
    });

    it('handles concurrent validations of same token correctly', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      // Simulate concurrent validations
      const result1 = service.validate(generateResult.value.token);
      const result2 = service.validate(generateResult.value.token);

      // One should succeed, one should fail
      const successCount = [result1, result2].filter((r) => r.ok).length;
      const failCount = [result1, result2].filter((r) => !r.ok).length;

      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // The failure should be TOKEN_ALREADY_USED
      const failedResult = [result1, result2].find((r) => !r.ok);
      if (failedResult && !failedResult.ok) {
        expect(failedResult.error.code).toBe('TOKEN_ALREADY_USED');
      }
    });

    it('handles multiple users generating tokens simultaneously', () => {
      const results = [];

      for (let userIndex = 0; userIndex < 3; userIndex++) {
        for (let tokenIndex = 0; tokenIndex < 3; tokenIndex++) {
          results.push(
            service.generate({
              userId: `user-${userIndex}`,
              streamId: `stream-${userIndex}-${tokenIndex}`,
            })
          );
        }
      }

      // All should succeed
      results.forEach((result) => {
        expect(result.ok).toBe(true);
      });

      // Verify token count per user
      for (let userIndex = 0; userIndex < 3; userIndex++) {
        const userTokens = service.getActiveTokensForUser(`user-${userIndex}`);
        expect(userTokens.length).toBe(3);
      }
    });
  });

  // =============================================================================
  // Peek (Non-Consuming Validation) Tests
  // =============================================================================

  describe('peek', () => {
    it('peeks at token without consuming it', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      // Peek should succeed
      const peekResult1 = service.peek(generateResult.value.token);
      expect(peekResult1.ok).toBe(true);

      // Peek again should still succeed
      const peekResult2 = service.peek(generateResult.value.token);
      expect(peekResult2.ok).toBe(true);

      // Validate should still succeed (token not consumed by peek)
      const validateResult = service.validate(generateResult.value.token);
      expect(validateResult.ok).toBe(true);
    });

    it('peek fails for expired token', async () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        expiryMs: 10,
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      await new Promise((resolve) => setTimeout(resolve, 50));

      const peekResult = service.peek(generateResult.value.token);
      expect(peekResult.ok).toBe(false);
      if (!peekResult.ok) {
        expect(peekResult.error.code).toBe('TOKEN_EXPIRED');
      }
    });

    it('peek fails for already used token', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      // Consume the token
      service.validate(generateResult.value.token);

      // Peek should fail
      const peekResult = service.peek(generateResult.value.token);
      expect(peekResult.ok).toBe(false);
      if (!peekResult.ok) {
        expect(peekResult.error.code).toBe('TOKEN_ALREADY_USED');
      }
    });
  });

  // =============================================================================
  // Scope Checking Tests
  // =============================================================================

  describe('hasScope', () => {
    it('returns true when token has required scope', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        scopes: ['stream:read', 'events:subscribe'],
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      expect(service.hasScope(generateResult.value.token, 'stream:read')).toBe(true);
      expect(service.hasScope(generateResult.value.token, 'events:subscribe')).toBe(true);
    });

    it('returns false when token lacks required scope', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        scopes: ['stream:read'],
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      expect(service.hasScope(generateResult.value.token, 'stream:write')).toBe(false);
    });

    it('returns true for wildcard scope', () => {
      const generateResult = service.generate({
        userId: 'user-123',
        streamId: 'stream-456',
        scopes: ['*'],
      });
      expect(generateResult.ok).toBe(true);
      if (!generateResult.ok) return;

      expect(service.hasScope(generateResult.value.token, 'stream:read')).toBe(true);
      expect(service.hasScope(generateResult.value.token, 'anything')).toBe(true);
    });

    it('returns false for non-existent token', () => {
      const fakeToken = `sse_${'a'.repeat(64)}`;
      expect(service.hasScope(fakeToken, 'stream:read')).toBe(false);
    });
  });

  // =============================================================================
  // Statistics Tests
  // =============================================================================

  describe('getStats', () => {
    it('returns correct statistics for empty service', () => {
      const stats = service.getStats();

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.used).toBe(0);
      expect(stats.expired).toBe(0);
    });

    it('returns correct statistics with mixed token states', async () => {
      // Generate active tokens
      for (let i = 0; i < 3; i++) {
        service.generate({
          userId: `user-${i}`,
          streamId: `stream-${i}`,
        });
      }

      // Generate and use some tokens
      for (let i = 3; i < 5; i++) {
        const result = service.generate({
          userId: `user-${i}`,
          streamId: `stream-${i}`,
        });
        if (result.ok) {
          service.validate(result.value.token);
        }
      }

      // Generate expired tokens
      for (let i = 5; i < 7; i++) {
        service.generate({
          userId: `user-${i}`,
          streamId: `stream-${i}`,
          expiryMs: 10,
        });
      }

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 50));

      const stats = service.getStats();

      expect(stats.total).toBe(7);
      expect(stats.active).toBe(3);
      expect(stats.used).toBe(2);
      expect(stats.expired).toBe(2);
    });
  });

  // =============================================================================
  // Get Active Tokens Tests
  // =============================================================================

  describe('getActiveTokensForUser', () => {
    it('returns active tokens for user', () => {
      for (let i = 0; i < 3; i++) {
        service.generate({
          userId: 'user-123',
          streamId: `stream-${i}`,
        });
      }

      const activeTokens = service.getActiveTokensForUser('user-123');

      expect(activeTokens.length).toBe(3);
      activeTokens.forEach((token) => {
        expect(token.userId).toBe('user-123');
        expect(token.used).toBe(false);
      });
    });

    it('excludes used tokens', () => {
      const results = [];
      for (let i = 0; i < 3; i++) {
        results.push(
          service.generate({
            userId: 'user-123',
            streamId: `stream-${i}`,
          })
        );
      }

      // Use one token
      if (results[0]?.ok) {
        service.validate(results[0].value.token);
      }

      const activeTokens = service.getActiveTokensForUser('user-123');
      expect(activeTokens.length).toBe(2);
    });

    it('excludes expired tokens', async () => {
      // Generate normal token
      service.generate({
        userId: 'user-123',
        streamId: 'stream-normal',
      });

      // Generate expiring token
      service.generate({
        userId: 'user-123',
        streamId: 'stream-expiring',
        expiryMs: 10,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const activeTokens = service.getActiveTokensForUser('user-123');
      expect(activeTokens.length).toBe(1);
      expect(activeTokens[0].streamId).toBe('stream-normal');
    });

    it('returns empty array for user with no tokens', () => {
      const activeTokens = service.getActiveTokensForUser('non-existent-user');
      expect(activeTokens).toEqual([]);
    });
  });
});
