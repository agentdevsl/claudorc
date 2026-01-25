/**
 * Shared utilities and types for API routes
 */

// CORS headers for dev
export const corsHeaders = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
} as const;

/**
 * Create a JSON response with CORS headers
 */
export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

/**
 * Validate that an ID is safe and properly formatted
 * Accepts cuid2 IDs and kebab-case string IDs
 */
export function isValidId(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  // Length check: reasonable ID lengths (1-100 chars)
  if (id.length < 1 || id.length > 100) return false;
  // Only allow alphanumeric, hyphens, underscores (safe for paths/queries)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Standard API error structure
 */
export interface ApiError {
  code: string;
  message: string;
  status?: number;
}

/**
 * Create an error response with consistent structure
 */
export function errorResponse(error: ApiError, status?: number): Response {
  return json(
    { ok: false, error: { code: error.code, message: error.message } },
    status ?? error.status ?? 400
  );
}

/**
 * Handle service result and return appropriate response
 * Returns null if result is ok, otherwise returns error Response
 */
export function handleServiceError<T>(
  result: { ok: false; error: ApiError } | { ok: true; value: T }
): Response | null {
  if (!result.ok) {
    return errorResponse(result.error, result.error.status);
  }
  return null;
}
