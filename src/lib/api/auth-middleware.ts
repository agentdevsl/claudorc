/**
 * Authentication Middleware for API Routes
 *
 * Provides authentication context extraction and validation.
 * Phase 1: Basic cookie/header check with dev mode bypass
 * Phase 2: Full validation against auth service (when implemented)
 *
 * @module lib/api/auth-middleware
 */

import { err, ok, type Result } from '../utils/result.js';

const SESSION_COOKIE_NAME = 'agentpane_session';

/**
 * Authentication context available in routes
 */
export interface AuthContext {
  userId: string;
  authMethod: 'session' | 'api_token' | 'dev';
}

/**
 * Authentication error
 */
export interface AuthError {
  code: 'UNAUTHORIZED' | 'FORBIDDEN';
  message: string;
  status: number;
}

/**
 * Extract user context from request
 *
 * Authentication methods (checked in order):
 * 1. Session cookie (agentpane_session)
 * 2. Authorization header (Bearer token)
 * 3. Development mode bypass (when SKIP_AUTH=true)
 *
 * @param request - The incoming request
 * @returns Authentication context or error
 */
export async function getAuthContext(request: Request): Promise<Result<AuthContext, AuthError>> {
  // 1. Check session cookie
  const cookies = request.headers.get('Cookie') ?? '';
  const sessionMatch = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));

  if (sessionMatch?.[1]) {
    const sessionToken = sessionMatch[1];
    // TODO Phase 2: Validate session token against database
    // For now, extract userId from token or use placeholder
    // In production, this would query the sessions table
    return ok({
      userId: `session:${sessionToken.substring(0, 8)}`,
      authMethod: 'session',
    });
  }

  // 2. Check Authorization header (API token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    // TODO Phase 2: Validate API token against database
    // For now, use token prefix as userId placeholder
    return ok({
      userId: `token:${token.substring(0, 8)}`,
      authMethod: 'api_token',
    });
  }

  // 3. Development mode: Allow unauthenticated requests
  if (process.env.NODE_ENV === 'development') {
    // Check for explicit skip or default dev user
    const skipAuth = process.env.SKIP_AUTH === 'true';
    if (skipAuth) {
      return ok({
        userId: 'dev-user',
        authMethod: 'dev',
      });
    }

    // In development without SKIP_AUTH, check for X-Dev-User header
    const devUser = request.headers.get('X-Dev-User');
    if (devUser) {
      return ok({
        userId: devUser,
        authMethod: 'dev',
      });
    }

    // Default: allow with dev user for local development
    return ok({
      userId: 'local-dev',
      authMethod: 'dev',
    });
  }

  // No authentication found
  return err({
    code: 'UNAUTHORIZED',
    message: 'Authentication required. Provide session cookie or Authorization header.',
    status: 401,
  });
}

/**
 * Handler input with authentication
 */
export type AuthenticatedHandlerInput<T = Record<string, unknown>> = T & {
  auth: AuthContext;
};

/**
 * Wrapper that requires authentication before calling the handler
 *
 * @example
 * ```typescript
 * POST: withAuth(async ({ request, auth }) => {
 *   console.log('User:', auth.userId);
 *   // ... handle request
 * }),
 * ```
 *
 * @param handler - The handler function that requires authentication
 * @returns Wrapped handler that checks auth first
 */
export function withAuth<T extends { request: Request }>(
  handler: (input: AuthenticatedHandlerInput<T>) => Promise<Response>
): (input: T) => Promise<Response> {
  return async (input: T): Promise<Response> => {
    const authResult = await getAuthContext(input.request);

    if (!authResult.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: {
            code: authResult.error.code,
            message: authResult.error.message,
          },
        }),
        {
          status: authResult.error.status,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return handler({ ...input, auth: authResult.value });
  };
}

/**
 * Validate that a userId in request data matches the authenticated user
 *
 * Used for presence updates to prevent spoofing another user's presence.
 *
 * @param requestUserId - The userId from the request body
 * @param authUserId - The authenticated user's ID
 * @returns true if valid, false if mismatch
 */
export function validateUserIdMatch(
  requestUserId: string | undefined,
  authUserId: string
): boolean {
  // If no userId in request, it's valid (will use auth userId)
  if (!requestUserId) {
    return true;
  }

  // In dev mode, allow any userId for testing
  if (authUserId.startsWith('dev-') || authUserId === 'local-dev') {
    return true;
  }

  // Extract the actual userId from the auth context
  // Auth context userId format: "session:xxxxx" or "token:xxxxx"
  const actualUserId = authUserId.includes(':') ? authUserId.split(':')[1] : authUserId;

  // Allow exact match or if request userId starts with the auth prefix
  return requestUserId === authUserId || requestUserId === actualUserId;
}

/**
 * Create a forbidden response for authorization failures
 */
export function forbiddenResponse(message: string): Response {
  return new Response(
    JSON.stringify({
      ok: false,
      error: {
        code: 'FORBIDDEN',
        message,
      },
    }),
    {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
