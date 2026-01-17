import type { Octokit } from 'octokit';
import { GitHubErrors } from '../errors/github-errors.js';
import type { Result } from '../utils/result.js';
import { err, ok } from '../utils/result.js';

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  used: number;
}

export interface RateLimitStatus {
  core: RateLimitInfo;
  search: RateLimitInfo;
  graphql: RateLimitInfo;
}

export async function getRateLimitStatus(
  octokit: Octokit
): Promise<Result<RateLimitStatus, Error>> {
  try {
    const { data } = await octokit.rest.rateLimit.get();

    return ok({
      core: {
        limit: data.rate.limit,
        remaining: data.rate.remaining,
        reset: new Date(data.rate.reset * 1000),
        used: data.rate.used,
      },
      search: {
        limit: data.resources.search.limit,
        remaining: data.resources.search.remaining,
        reset: new Date(data.resources.search.reset * 1000),
        used: data.resources.search.used,
      },
      graphql: {
        limit: data.resources.graphql?.limit ?? 0,
        remaining: data.resources.graphql?.remaining ?? 0,
        reset: new Date((data.resources.graphql?.reset ?? 0) * 1000),
        used: data.resources.graphql?.used ?? 0,
      },
    });
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

export function checkRateLimit(
  status: RateLimitStatus
): Result<void, ReturnType<typeof GitHubErrors.RATE_LIMITED>> {
  // Check if we're running low on core API requests
  if (status.core.remaining < 10) {
    return err(GitHubErrors.RATE_LIMITED(Math.floor(status.core.reset.getTime() / 1000)));
  }

  return ok(undefined);
}

export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    onRateLimited?: (resetAt: Date) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, onRateLimited } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const statusCode = (error as { status?: number }).status;

      if (statusCode === 429 || statusCode === 403) {
        const resetHeader = (error as { response?: { headers?: { 'x-ratelimit-reset'?: string } } })
          .response?.headers?.['x-ratelimit-reset'];

        if (resetHeader) {
          const resetAt = new Date(Number.parseInt(resetHeader, 10) * 1000);
          const waitTime = Math.max(0, resetAt.getTime() - Date.now());

          if (onRateLimited) {
            onRateLimited(resetAt);
          }

          if (waitTime > 0 && waitTime < 60000) {
            // Wait up to 1 minute
            await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
            continue;
          }
        }
      }

      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError ?? new Error('Rate limit retry exhausted');
}
