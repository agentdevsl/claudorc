import type { createError } from '@/lib/errors/base';
import { ok, type Result } from '@/lib/utils/result';

/**
 * Client-side services configuration.
 * Database runs on server - client uses API endpoints for data access.
 */
export type Services = {
  // Client mode flag - components should use API hooks for data
  isClientMode: true;
};

export type ServicesResult = Result<Services, ReturnType<typeof createError>>;

/**
 * Create client-side services.
 * All data access goes through API endpoints.
 */
export function createServices(_context: { streams?: unknown }): ServicesResult {
  console.log('[Services] Client mode - using API endpoints for data access');
  return ok({
    isClientMode: true,
  });
}
