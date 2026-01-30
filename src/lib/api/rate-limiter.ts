/**
 * Simple in-memory rate limiter middleware for Hono.
 *
 * Uses a sliding window counter per IP address.
 * For production with multiple instances, replace with Redis-backed limiter.
 */

import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 60s
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) {
      store.delete(key);
    }
  }
}, 60_000);

export interface RateLimitOptions {
  /** Max requests per window (default: 100) */
  max?: number;
  /** Window size in milliseconds (default: 60_000 = 1 minute) */
  windowMs?: number;
}

/**
 * Create a rate limiting middleware.
 *
 * @example
 * app.use('/api/*', rateLimiter({ max: 100, windowMs: 60_000 }));
 */
export function rateLimiter(opts?: RateLimitOptions) {
  const max = opts?.max ?? 100;
  const windowMs = opts?.windowMs ?? 60_000;

  return async (c: Context, next: Next) => {
    // Use forwarded IP or remote address
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown';

    const now = Date.now();
    let entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(ip, entry);
    }

    entry.count += 1;

    // Set rate limit headers
    c.header('X-RateLimit-Limit', String(max));
    c.header('X-RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return c.json(
        {
          ok: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests. Please try again later.',
          },
        },
        429
      );
    }

    return next();
  };
}
