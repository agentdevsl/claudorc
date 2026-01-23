/**
 * SSE Token Service
 *
 * Provides secure, short-lived tokens for authenticating SSE (Server-Sent Events) connections.
 * Unlike session cookies, SSE connections need special handling because:
 * 1. EventSource API doesn't support custom headers
 * 2. Cookies may not be sent correctly in all scenarios
 * 3. Short-lived tokens limit exposure window for replay attacks
 *
 * Flow:
 * 1. Client requests SSE token via POST /api/auth/sse-token
 * 2. Server generates short-lived token (5 minutes)
 * 3. Client connects to SSE endpoint with token in query param
 * 4. Server validates token and establishes connection
 * 5. Token is invalidated after use (one-time use)
 */
import { createId } from '@paralleldrive/cuid2';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';

// Token configuration
const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
const TOKEN_PREFIX = 'sse_';
const MAX_TOKENS_PER_USER = 10; // Prevent token accumulation
const CLEANUP_INTERVAL_MS = 60 * 1000; // Clean expired tokens every minute

/**
 * SSE Token error types
 */
export type SSETokenError =
  | { code: 'INVALID_TOKEN'; message: string }
  | { code: 'TOKEN_EXPIRED'; message: string }
  | { code: 'TOKEN_ALREADY_USED'; message: string }
  | { code: 'TOKEN_NOT_FOUND'; message: string }
  | { code: 'MAX_TOKENS_EXCEEDED'; message: string }
  | { code: 'INTERNAL_ERROR'; message: string };

/**
 * SSE Token metadata
 */
export interface SSEToken {
  id: string;
  token: string;
  userId: string;
  streamId: string;
  scopes: string[];
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
}

/**
 * Token validation result
 */
export interface TokenValidationResult {
  userId: string;
  streamId: string;
  scopes: string[];
}

/**
 * Token generation options
 */
export interface GenerateTokenOptions {
  userId: string;
  streamId: string;
  scopes?: string[];
  expiryMs?: number;
}

/**
 * SSE Token Service
 *
 * Manages short-lived tokens for SSE authentication.
 * Uses in-memory storage for fast access and automatic cleanup.
 */
export class SSETokenService {
  private tokens = new Map<string, SSEToken>();
  private userTokens = new Map<string, Set<string>>(); // userId -> token IDs
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startCleanup();
  }

  /**
   * Generate a new SSE token for a user
   */
  generate(options: GenerateTokenOptions): Result<SSEToken, SSETokenError> {
    const { userId, streamId, scopes = ['stream:read'], expiryMs = TOKEN_EXPIRY_MS } = options;

    try {
      // Check token limit per user
      const userTokenIds = this.userTokens.get(userId);
      if (userTokenIds && userTokenIds.size >= MAX_TOKENS_PER_USER) {
        // Clean up expired tokens for this user first
        this.cleanupUserTokens(userId);

        // Check again after cleanup
        const refreshedUserTokenIds = this.userTokens.get(userId);
        if (refreshedUserTokenIds && refreshedUserTokenIds.size >= MAX_TOKENS_PER_USER) {
          return err({
            code: 'MAX_TOKENS_EXCEEDED',
            message: `Maximum active tokens (${MAX_TOKENS_PER_USER}) exceeded for user`,
          });
        }
      }

      const id = createId();
      const token = this.generateSecureToken();
      const now = Date.now();

      const sseToken: SSEToken = {
        id,
        token,
        userId,
        streamId,
        scopes,
        createdAt: now,
        expiresAt: now + expiryMs,
        used: false,
      };

      this.tokens.set(token, sseToken);

      // Track tokens per user
      if (!this.userTokens.has(userId)) {
        this.userTokens.set(userId, new Set());
      }
      this.userTokens.get(userId)?.add(token);

      return ok(sseToken);
    } catch (error) {
      return err({
        code: 'INTERNAL_ERROR',
        message: `Failed to generate token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Validate and consume an SSE token
   * Tokens are single-use - once validated, they cannot be used again
   */
  validate(token: string): Result<TokenValidationResult, SSETokenError> {
    // Validate token format
    if (!this.isValidTokenFormat(token)) {
      return err({
        code: 'INVALID_TOKEN',
        message: 'Invalid token format',
      });
    }

    const sseToken = this.tokens.get(token);

    if (!sseToken) {
      return err({
        code: 'TOKEN_NOT_FOUND',
        message: 'Token not found',
      });
    }

    // Check if already used
    if (sseToken.used) {
      return err({
        code: 'TOKEN_ALREADY_USED',
        message: 'Token has already been used',
      });
    }

    // Check expiration
    if (Date.now() > sseToken.expiresAt) {
      // Clean up expired token
      this.removeToken(token);
      return err({
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      });
    }

    // Mark as used (single-use)
    sseToken.used = true;
    sseToken.usedAt = Date.now();

    return ok({
      userId: sseToken.userId,
      streamId: sseToken.streamId,
      scopes: sseToken.scopes,
    });
  }

  /**
   * Validate a token without consuming it (peek)
   * Useful for checking token validity before establishing connection
   */
  peek(token: string): Result<TokenValidationResult, SSETokenError> {
    if (!this.isValidTokenFormat(token)) {
      return err({
        code: 'INVALID_TOKEN',
        message: 'Invalid token format',
      });
    }

    const sseToken = this.tokens.get(token);

    if (!sseToken) {
      return err({
        code: 'TOKEN_NOT_FOUND',
        message: 'Token not found',
      });
    }

    if (sseToken.used) {
      return err({
        code: 'TOKEN_ALREADY_USED',
        message: 'Token has already been used',
      });
    }

    if (Date.now() > sseToken.expiresAt) {
      return err({
        code: 'TOKEN_EXPIRED',
        message: 'Token has expired',
      });
    }

    return ok({
      userId: sseToken.userId,
      streamId: sseToken.streamId,
      scopes: sseToken.scopes,
    });
  }

  /**
   * Revoke a specific token
   */
  revoke(token: string): Result<void, SSETokenError> {
    const sseToken = this.tokens.get(token);

    if (!sseToken) {
      return err({
        code: 'TOKEN_NOT_FOUND',
        message: 'Token not found',
      });
    }

    this.removeToken(token);
    return ok(undefined);
  }

  /**
   * Revoke all tokens for a user
   */
  revokeAllForUser(userId: string): Result<number, SSETokenError> {
    const userTokenIds = this.userTokens.get(userId);

    if (!userTokenIds || userTokenIds.size === 0) {
      return ok(0);
    }

    const count = userTokenIds.size;
    for (const token of userTokenIds) {
      this.tokens.delete(token);
    }
    this.userTokens.delete(userId);

    return ok(count);
  }

  /**
   * Get all active (non-expired, non-used) tokens for a user
   */
  getActiveTokensForUser(userId: string): SSEToken[] {
    const userTokenIds = this.userTokens.get(userId);
    if (!userTokenIds) {
      return [];
    }

    const now = Date.now();
    const activeTokens: SSEToken[] = [];

    for (const token of userTokenIds) {
      const sseToken = this.tokens.get(token);
      if (sseToken && !sseToken.used && sseToken.expiresAt > now) {
        activeTokens.push(sseToken);
      }
    }

    return activeTokens;
  }

  /**
   * Get token count statistics
   */
  getStats(): { total: number; active: number; used: number; expired: number } {
    const now = Date.now();
    let active = 0;
    let used = 0;
    let expired = 0;

    for (const token of this.tokens.values()) {
      if (token.used) {
        used++;
      } else if (token.expiresAt <= now) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.tokens.size,
      active,
      used,
      expired,
    };
  }

  /**
   * Check if a token has a specific scope
   */
  hasScope(token: string, requiredScope: string): boolean {
    const sseToken = this.tokens.get(token);
    if (!sseToken) {
      return false;
    }
    return sseToken.scopes.includes(requiredScope) || sseToken.scopes.includes('*');
  }

  /**
   * Manually trigger cleanup of expired tokens
   */
  cleanup(): number {
    const now = Date.now();
    let removed = 0;

    for (const [token, sseToken] of this.tokens.entries()) {
      if (sseToken.expiresAt <= now || sseToken.used) {
        this.removeToken(token);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Stop the cleanup interval (for testing/shutdown)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all tokens (for testing)
   */
  clear(): void {
    this.tokens.clear();
    this.userTokens.clear();
  }

  // Private methods

  private generateSecureToken(): string {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const hex = Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `${TOKEN_PREFIX}${hex}`;
  }

  private isValidTokenFormat(token: string): boolean {
    if (!token || typeof token !== 'string') {
      return false;
    }
    // Token format: sse_ + 64 hex characters
    return token.startsWith(TOKEN_PREFIX) && /^sse_[a-f0-9]{64}$/.test(token);
  }

  private removeToken(token: string): void {
    const sseToken = this.tokens.get(token);
    if (sseToken) {
      this.tokens.delete(token);

      const userTokenIds = this.userTokens.get(sseToken.userId);
      if (userTokenIds) {
        userTokenIds.delete(token);
        if (userTokenIds.size === 0) {
          this.userTokens.delete(sseToken.userId);
        }
      }
    }
  }

  private cleanupUserTokens(userId: string): void {
    const userTokenIds = this.userTokens.get(userId);
    if (!userTokenIds) {
      return;
    }

    const now = Date.now();
    for (const token of userTokenIds) {
      const sseToken = this.tokens.get(token);
      if (sseToken && (sseToken.expiresAt <= now || sseToken.used)) {
        this.removeToken(token);
      }
    }
  }

  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, CLEANUP_INTERVAL_MS);

    // Allow the interval to not prevent process exit
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }
}

/**
 * Singleton instance for application-wide use
 */
export const sseTokenService = new SSETokenService();
