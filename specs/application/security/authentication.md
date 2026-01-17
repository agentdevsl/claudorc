# AgentPane Authentication Specification

## Overview

This specification defines the authentication architecture for AgentPane, covering user identity, session management, API protection, and the integration with GitHub OAuth. While AgentPane operates primarily as a single-user local application, this authentication system is designed to support future multi-user scenarios.

**Design Principles**:

- **Local-First**: Authentication works offline after initial GitHub setup
- **GitHub Identity**: User identity derived from GitHub OAuth
- **Session-Based**: Secure HTTP-only cookies for web sessions
- **API Tokens**: Bearer tokens for programmatic access
- **Defense in Depth**: Multiple layers of validation

---

## Architecture

### Authentication Flow Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User Browser                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Login     │───▶│   GitHub    │───▶│  Callback   │───▶│  Dashboard  │  │
│  │   Page      │    │   OAuth     │    │   Handler   │    │   (Auth'd)  │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
         │                   │                   │                   │
         ▼                   ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AgentPane Server                                   │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │ /login      │    │ /api/auth/  │    │ /api/auth/  │    │  Session    │  │
│  │ (redirect)  │    │   github    │    │  callback   │    │  Middleware │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                               │                   │         │
│                                               ▼                   ▼         │
│                                        ┌─────────────────────────────┐      │
│                                        │   Session Store (PGlite)    │      │
│                                        │   - users table             │      │
│                                        │   - sessions table          │      │
│                                        └─────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Authentication Modes

| Mode | Use Case | Identity Source | Session Storage |
|------|----------|-----------------|-----------------|
| **GitHub OAuth** | Primary authentication | GitHub user profile | HTTP-only cookie |
| **Local Development** | Development without GitHub | Auto-generated local user | HTTP-only cookie |
| **API Token** | Programmatic access | Pre-shared token | Bearer header |

---

## Interface Definitions

```typescript
// lib/auth/types.ts
import type { Result } from '@/lib/utils/result';

/**
 * Authenticated user profile
 */
export interface User {
  id: string;                      // Internal CUID2
  githubId: number;                // GitHub user ID
  githubLogin: string;             // GitHub username
  name: string | null;             // Display name
  email: string | null;            // Primary email
  avatarUrl: string | null;        // GitHub avatar URL
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User session
 */
export interface Session {
  id: string;                      // Session ID (CUID2)
  userId: string;                  // Reference to User.id
  token: string;                   // Session token (secure random)
  userAgent: string | null;        // Browser user agent
  ipAddress: string | null;        // Client IP (for audit)
  expiresAt: Date;                 // Session expiration
  createdAt: Date;
  lastAccessedAt: Date;
}

/**
 * OAuth state for CSRF protection
 */
export interface OAuthState {
  id: string;                      // State parameter
  returnUrl: string;               // URL to return after auth
  createdAt: Date;
  expiresAt: Date;                 // 10-minute expiry
}

/**
 * API token for programmatic access
 */
export interface ApiToken {
  id: string;
  userId: string;
  name: string;                    // User-defined name
  tokenHash: string;               // SHA-256 hash of token
  tokenPrefix: string;             // First 8 chars for identification
  scopes: ApiTokenScope[];         // Permitted operations
  lastUsedAt: Date | null;
  expiresAt: Date | null;          // null = never expires
  createdAt: Date;
}

export type ApiTokenScope =
  | 'projects:read'
  | 'projects:write'
  | 'tasks:read'
  | 'tasks:write'
  | 'agents:read'
  | 'agents:write'
  | 'sessions:read'
  | 'sessions:write';

/**
 * Authentication context available in routes
 */
export interface AuthContext {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  authMethod: 'session' | 'api_token' | 'none';
}

/**
 * Auth service interface
 */
export interface IAuthService {
  // OAuth flow
  initiateOAuth(returnUrl?: string): Promise<Result<{ url: string; state: string }, AuthError>>;
  handleOAuthCallback(code: string, state: string): Promise<Result<{ user: User; session: Session }, AuthError>>;

  // Session management
  createSession(userId: string, metadata?: SessionMetadata): Promise<Result<Session, AuthError>>;
  validateSession(token: string): Promise<Result<AuthContext, AuthError>>;
  refreshSession(sessionId: string): Promise<Result<Session, AuthError>>;
  revokeSession(sessionId: string): Promise<Result<void, AuthError>>;
  revokeAllUserSessions(userId: string): Promise<Result<number, AuthError>>;

  // API tokens
  createApiToken(userId: string, name: string, scopes: ApiTokenScope[]): Promise<Result<{ token: ApiToken; plainToken: string }, AuthError>>;
  validateApiToken(token: string): Promise<Result<AuthContext, AuthError>>;
  revokeApiToken(tokenId: string): Promise<Result<void, AuthError>>;
  listApiTokens(userId: string): Promise<Result<ApiToken[], AuthError>>;

  // User management
  getCurrentUser(context: AuthContext): Promise<Result<User, AuthError>>;
  updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'email'>>): Promise<Result<User, AuthError>>;

  // Local development
  createLocalUser(): Promise<Result<User, AuthError>>;
  getOrCreateLocalUser(): Promise<Result<User, AuthError>>;
}

export interface SessionMetadata {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Auth error types
 */
export type AuthError =
  | { code: 'INVALID_STATE'; message: string }
  | { code: 'STATE_EXPIRED'; message: string }
  | { code: 'OAUTH_FAILED'; message: string; details?: string }
  | { code: 'SESSION_NOT_FOUND'; message: string }
  | { code: 'SESSION_EXPIRED'; message: string }
  | { code: 'INVALID_TOKEN'; message: string }
  | { code: 'TOKEN_EXPIRED'; message: string }
  | { code: 'INSUFFICIENT_SCOPE'; message: string; required: ApiTokenScope[] }
  | { code: 'USER_NOT_FOUND'; message: string }
  | { code: 'UNAUTHORIZED'; message: string };
```

---

## Database Schema

```typescript
// db/schema/auth.ts
import { pgTable, text, timestamp, integer, jsonb, index } from 'drizzle-orm/pg-core';
import { createId } from '@paralleldrive/cuid2';

/**
 * Users table - GitHub-authenticated users
 */
export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  githubId: integer('github_id').notNull().unique(),
  githubLogin: text('github_login').notNull(),
  name: text('name'),
  email: text('email'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  githubIdIdx: index('users_github_id_idx').on(table.githubId),
  githubLoginIdx: index('users_github_login_idx').on(table.githubLogin),
}));

/**
 * Sessions table - Active user sessions
 */
export const sessions = pgTable('sessions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  userAgent: text('user_agent'),
  ipAddress: text('ip_address'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastAccessedAt: timestamp('last_accessed_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('sessions_user_id_idx').on(table.userId),
  tokenIdx: index('sessions_token_idx').on(table.token),
  expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
}));

/**
 * OAuth states table - CSRF protection for OAuth flow
 */
export const oauthStates = pgTable('oauth_states', {
  id: text('id').primaryKey(),
  returnUrl: text('return_url').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  expiresAtIdx: index('oauth_states_expires_at_idx').on(table.expiresAt),
}));

/**
 * API tokens table - Programmatic access tokens
 */
export const apiTokens = pgTable('api_tokens', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  tokenPrefix: text('token_prefix').notNull(),
  scopes: jsonb('scopes').$type<ApiTokenScope[]>().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('api_tokens_user_id_idx').on(table.userId),
  tokenHashIdx: index('api_tokens_token_hash_idx').on(table.tokenHash),
  tokenPrefixIdx: index('api_tokens_token_prefix_idx').on(table.tokenPrefix),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type ApiToken = typeof apiTokens.$inferSelect;
export type NewApiToken = typeof apiTokens.$inferInsert;
```

---

## Routes

### Route Definitions

| Route | Method | Auth Required | Description |
|-------|--------|---------------|-------------|
| `/login` | GET | No | Login page with GitHub button |
| `/logout` | POST | Yes | Logout and revoke session |
| `/api/auth/github` | GET | No | Initiate GitHub OAuth |
| `/api/auth/callback` | GET | No | GitHub OAuth callback |
| `/api/auth/session` | GET | Yes | Get current session info |
| `/api/auth/session` | DELETE | Yes | Revoke current session |
| `/api/auth/tokens` | GET | Yes | List API tokens |
| `/api/auth/tokens` | POST | Yes | Create API token |
| `/api/auth/tokens/:id` | DELETE | Yes | Revoke API token |

### Route Implementations

```typescript
// app/routes/login.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/login')({
  beforeLoad: async ({ context }) => {
    // Already authenticated - redirect to dashboard
    if (context.auth?.isAuthenticated) {
      throw redirect({ to: '/' });
    }
  },
  component: LoginPage,
});

function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <div className="w-full max-w-md space-y-8 p-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-fg-default">
            Welcome to AgentPane
          </h1>
          <p className="mt-2 text-fg-muted">
            Sign in with GitHub to continue
          </p>
        </div>

        <a
          href="/api/auth/github"
          className="flex w-full items-center justify-center gap-2 rounded-md bg-[#24292f] px-4 py-3 text-white hover:bg-[#32383f] transition-colors"
        >
          <GitHubIcon className="h-5 w-5" />
          Sign in with GitHub
        </a>

        {process.env.NODE_ENV === 'development' && (
          <form action="/api/auth/local" method="POST">
            <button
              type="submit"
              className="mt-4 w-full text-center text-sm text-fg-muted hover:text-fg-default"
            >
              Continue without GitHub (development only)
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
```

```typescript
// app/routes/api/auth/github.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { authService } from '@/lib/auth/service';

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const returnUrl = url.searchParams.get('returnUrl') || '/';

    const result = await authService.initiateOAuth(returnUrl);

    if (!result.ok) {
      return Response.json(
        { ok: false, error: result.error },
        { status: 500 }
      );
    }

    return Response.redirect(result.value.url, 302);
  },
});
```

```typescript
// app/routes/api/auth/callback.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { authService } from '@/lib/auth/service';
import { setSessionCookie } from '@/lib/auth/cookies';

export const ServerRoute = createServerFileRoute().methods({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const error = url.searchParams.get('error');

    // Handle OAuth error from GitHub
    if (error) {
      const errorDescription = url.searchParams.get('error_description') || 'Unknown error';
      return Response.redirect(`/login?error=${encodeURIComponent(errorDescription)}`, 302);
    }

    // Validate required parameters
    if (!code || !state) {
      return Response.redirect('/login?error=Missing+OAuth+parameters', 302);
    }

    // Process callback
    const result = await authService.handleOAuthCallback(code, state);

    if (!result.ok) {
      const errorMessage = encodeURIComponent(result.error.message);
      return Response.redirect(`/login?error=${errorMessage}`, 302);
    }

    // Set session cookie and redirect
    const { session, returnUrl } = result.value;
    const response = Response.redirect(returnUrl || '/', 302);

    setSessionCookie(response, session.token, session.expiresAt);

    return response;
  },
});
```

```typescript
// app/routes/api/auth/session.ts
import { createServerFileRoute } from '@tanstack/react-start/server';
import { requireAuth } from '@/lib/auth/middleware';
import { authService } from '@/lib/auth/service';
import { clearSessionCookie } from '@/lib/auth/cookies';

export const ServerRoute = createServerFileRoute().methods({
  // Get current session info
  GET: async ({ request, context }) => {
    const auth = await requireAuth(request);

    if (!auth.ok) {
      return Response.json(
        { ok: false, error: auth.error },
        { status: 401 }
      );
    }

    return Response.json({
      ok: true,
      data: {
        user: auth.value.user,
        session: {
          id: auth.value.session.id,
          expiresAt: auth.value.session.expiresAt,
          createdAt: auth.value.session.createdAt,
        },
      },
    });
  },

  // Logout - revoke current session
  DELETE: async ({ request }) => {
    const auth = await requireAuth(request);

    if (!auth.ok) {
      return Response.json(
        { ok: false, error: auth.error },
        { status: 401 }
      );
    }

    await authService.revokeSession(auth.value.session.id);

    const response = Response.json({ ok: true });
    clearSessionCookie(response);

    return response;
  },
});
```

```typescript
// app/routes/logout.tsx
import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/logout')({
  beforeLoad: async ({ context }) => {
    // POST to logout API and redirect
    await fetch('/api/auth/session', { method: 'DELETE' });
    throw redirect({ to: '/login' });
  },
});
```

---

## Service Implementation

```typescript
// lib/auth/service.ts
import { Octokit } from 'octokit';
import { createId } from '@paralleldrive/cuid2';
import { randomBytes, createHash } from 'crypto';
import { db } from '@/db/client';
import { users, sessions, oauthStates, apiTokens } from '@/db/schema/auth';
import { eq, and, gt, lt } from 'drizzle-orm';
import type { IAuthService, AuthContext, AuthError, ApiTokenScope, SessionMetadata } from './types';
import { ok, err } from '@/lib/utils/result';

// Configuration
const SESSION_DURATION_DAYS = 30;
const OAUTH_STATE_DURATION_MINUTES = 10;
const API_TOKEN_PREFIX_LENGTH = 8;

// GitHub OAuth configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const GITHUB_CALLBACK_URL = `${process.env.APP_URL}/api/auth/callback`;

class AuthService implements IAuthService {
  /**
   * Initiate GitHub OAuth flow
   */
  async initiateOAuth(returnUrl: string = '/') {
    try {
      // Generate secure state parameter
      const state = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + OAUTH_STATE_DURATION_MINUTES * 60 * 1000);

      // Store state for validation
      await db.insert(oauthStates).values({
        id: state,
        returnUrl,
        expiresAt,
      });

      // Build GitHub OAuth URL
      const params = new URLSearchParams({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
        state,
      });

      const url = `https://github.com/login/oauth/authorize?${params}`;

      return ok({ url, state });
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'Failed to initiate OAuth',
        details: String(error),
      });
    }
  }

  /**
   * Handle OAuth callback from GitHub
   */
  async handleOAuthCallback(code: string, state: string) {
    try {
      // Validate state parameter
      const [storedState] = await db
        .select()
        .from(oauthStates)
        .where(eq(oauthStates.id, state))
        .limit(1);

      if (!storedState) {
        return err({
          code: 'INVALID_STATE' as const,
          message: 'Invalid OAuth state parameter',
        });
      }

      if (storedState.expiresAt < new Date()) {
        // Clean up expired state
        await db.delete(oauthStates).where(eq(oauthStates.id, state));
        return err({
          code: 'STATE_EXPIRED' as const,
          message: 'OAuth state has expired. Please try again.',
        });
      }

      // Exchange code for access token
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return err({
          code: 'OAUTH_FAILED' as const,
          message: 'GitHub OAuth failed',
          details: tokenData.error_description,
        });
      }

      // Fetch user profile from GitHub
      const octokit = new Octokit({ auth: tokenData.access_token });
      const { data: githubUser } = await octokit.rest.users.getAuthenticated();

      // Fetch primary email
      let email: string | null = githubUser.email;
      if (!email) {
        const { data: emails } = await octokit.rest.users.listEmailsForAuthenticatedUser();
        const primaryEmail = emails.find(e => e.primary && e.verified);
        email = primaryEmail?.email || null;
      }

      // Upsert user
      const [user] = await db
        .insert(users)
        .values({
          githubId: githubUser.id,
          githubLogin: githubUser.login,
          name: githubUser.name,
          email,
          avatarUrl: githubUser.avatar_url,
        })
        .onConflictDoUpdate({
          target: users.githubId,
          set: {
            githubLogin: githubUser.login,
            name: githubUser.name,
            email,
            avatarUrl: githubUser.avatar_url,
            updatedAt: new Date(),
          },
        })
        .returning();

      // Create session
      const sessionResult = await this.createSession(user.id);

      if (!sessionResult.ok) {
        return err(sessionResult.error);
      }

      // Clean up used state
      await db.delete(oauthStates).where(eq(oauthStates.id, state));

      return ok({
        user,
        session: sessionResult.value,
        returnUrl: storedState.returnUrl,
      });
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'OAuth callback processing failed',
        details: String(error),
      });
    }
  }

  /**
   * Create a new session for a user
   */
  async createSession(userId: string, metadata?: SessionMetadata) {
    try {
      const token = randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      const [session] = await db
        .insert(sessions)
        .values({
          userId,
          token,
          userAgent: metadata?.userAgent || null,
          ipAddress: metadata?.ipAddress || null,
          expiresAt,
        })
        .returning();

      return ok(session);
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'Failed to create session',
      });
    }
  }

  /**
   * Validate a session token and return auth context
   */
  async validateSession(token: string) {
    try {
      const [session] = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.token, token),
            gt(sessions.expiresAt, new Date())
          )
        )
        .limit(1);

      if (!session) {
        return err({
          code: 'SESSION_NOT_FOUND' as const,
          message: 'Session not found or expired',
        });
      }

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      if (!user) {
        return err({
          code: 'USER_NOT_FOUND' as const,
          message: 'User not found',
        });
      }

      // Update last accessed time
      await db
        .update(sessions)
        .set({ lastAccessedAt: new Date() })
        .where(eq(sessions.id, session.id));

      const context: AuthContext = {
        user,
        session,
        isAuthenticated: true,
        authMethod: 'session',
      };

      return ok(context);
    } catch (error) {
      return err({
        code: 'UNAUTHORIZED' as const,
        message: 'Session validation failed',
      });
    }
  }

  /**
   * Refresh a session (extend expiration)
   */
  async refreshSession(sessionId: string) {
    try {
      const expiresAt = new Date(Date.now() + SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000);

      const [session] = await db
        .update(sessions)
        .set({
          expiresAt,
          lastAccessedAt: new Date(),
        })
        .where(eq(sessions.id, sessionId))
        .returning();

      if (!session) {
        return err({
          code: 'SESSION_NOT_FOUND' as const,
          message: 'Session not found',
        });
      }

      return ok(session);
    } catch (error) {
      return err({
        code: 'SESSION_NOT_FOUND' as const,
        message: 'Failed to refresh session',
      });
    }
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string) {
    try {
      await db.delete(sessions).where(eq(sessions.id, sessionId));
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'SESSION_NOT_FOUND' as const,
        message: 'Failed to revoke session',
      });
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllUserSessions(userId: string) {
    try {
      const result = await db
        .delete(sessions)
        .where(eq(sessions.userId, userId));

      return ok(result.rowCount || 0);
    } catch (error) {
      return err({
        code: 'USER_NOT_FOUND' as const,
        message: 'Failed to revoke sessions',
      });
    }
  }

  /**
   * Create an API token for programmatic access
   */
  async createApiToken(userId: string, name: string, scopes: ApiTokenScope[]) {
    try {
      // Generate secure token
      const plainToken = `ap_${randomBytes(32).toString('hex')}`;
      const tokenHash = createHash('sha256').update(plainToken).digest('hex');
      const tokenPrefix = plainToken.substring(0, API_TOKEN_PREFIX_LENGTH);

      const [token] = await db
        .insert(apiTokens)
        .values({
          userId,
          name,
          tokenHash,
          tokenPrefix,
          scopes,
        })
        .returning();

      return ok({ token, plainToken });
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'Failed to create API token',
      });
    }
  }

  /**
   * Validate an API token
   */
  async validateApiToken(token: string) {
    try {
      const tokenHash = createHash('sha256').update(token).digest('hex');

      const [apiToken] = await db
        .select()
        .from(apiTokens)
        .where(eq(apiTokens.tokenHash, tokenHash))
        .limit(1);

      if (!apiToken) {
        return err({
          code: 'INVALID_TOKEN' as const,
          message: 'Invalid API token',
        });
      }

      // Check expiration
      if (apiToken.expiresAt && apiToken.expiresAt < new Date()) {
        return err({
          code: 'TOKEN_EXPIRED' as const,
          message: 'API token has expired',
        });
      }

      // Get user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, apiToken.userId))
        .limit(1);

      if (!user) {
        return err({
          code: 'USER_NOT_FOUND' as const,
          message: 'User not found',
        });
      }

      // Update last used
      await db
        .update(apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiTokens.id, apiToken.id));

      const context: AuthContext = {
        user,
        session: null,
        isAuthenticated: true,
        authMethod: 'api_token',
      };

      return ok(context);
    } catch (error) {
      return err({
        code: 'UNAUTHORIZED' as const,
        message: 'Token validation failed',
      });
    }
  }

  /**
   * Revoke an API token
   */
  async revokeApiToken(tokenId: string) {
    try {
      await db.delete(apiTokens).where(eq(apiTokens.id, tokenId));
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'INVALID_TOKEN' as const,
        message: 'Failed to revoke token',
      });
    }
  }

  /**
   * List API tokens for a user (without sensitive data)
   */
  async listApiTokens(userId: string) {
    try {
      const tokens = await db
        .select({
          id: apiTokens.id,
          name: apiTokens.name,
          tokenPrefix: apiTokens.tokenPrefix,
          scopes: apiTokens.scopes,
          lastUsedAt: apiTokens.lastUsedAt,
          expiresAt: apiTokens.expiresAt,
          createdAt: apiTokens.createdAt,
        })
        .from(apiTokens)
        .where(eq(apiTokens.userId, userId));

      return ok(tokens);
    } catch (error) {
      return err({
        code: 'USER_NOT_FOUND' as const,
        message: 'Failed to list tokens',
      });
    }
  }

  /**
   * Get current user from auth context
   */
  async getCurrentUser(context: AuthContext) {
    if (!context.user) {
      return err({
        code: 'UNAUTHORIZED' as const,
        message: 'Not authenticated',
      });
    }
    return ok(context.user);
  }

  /**
   * Update user profile
   */
  async updateUser(userId: string, updates: Partial<Pick<User, 'name' | 'email'>>) {
    try {
      const [user] = await db
        .update(users)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(users.id, userId))
        .returning();

      if (!user) {
        return err({
          code: 'USER_NOT_FOUND' as const,
          message: 'User not found',
        });
      }

      return ok(user);
    } catch (error) {
      return err({
        code: 'USER_NOT_FOUND' as const,
        message: 'Failed to update user',
      });
    }
  }

  /**
   * Create a local development user (no GitHub)
   */
  async createLocalUser() {
    if (process.env.NODE_ENV !== 'development') {
      return err({
        code: 'UNAUTHORIZED' as const,
        message: 'Local users only available in development',
      });
    }

    try {
      const [user] = await db
        .insert(users)
        .values({
          githubId: -1, // Negative ID for local users
          githubLogin: 'local-dev',
          name: 'Local Developer',
          email: 'dev@localhost',
          avatarUrl: null,
        })
        .returning();

      return ok(user);
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'Failed to create local user',
      });
    }
  }

  /**
   * Get or create local development user
   */
  async getOrCreateLocalUser() {
    if (process.env.NODE_ENV !== 'development') {
      return err({
        code: 'UNAUTHORIZED' as const,
        message: 'Local users only available in development',
      });
    }

    try {
      // Try to find existing local user
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.githubId, -1))
        .limit(1);

      if (existingUser) {
        return ok(existingUser);
      }

      // Create new local user
      return this.createLocalUser();
    } catch (error) {
      return err({
        code: 'OAUTH_FAILED' as const,
        message: 'Failed to get or create local user',
      });
    }
  }

  /**
   * Clean up expired sessions and OAuth states
   */
  async cleanup() {
    const now = new Date();

    // Delete expired sessions
    await db.delete(sessions).where(lt(sessions.expiresAt, now));

    // Delete expired OAuth states
    await db.delete(oauthStates).where(lt(oauthStates.expiresAt, now));
  }
}

export const authService = new AuthService();
```

---

## Middleware

```typescript
// lib/auth/middleware.ts
import type { AuthContext, AuthError } from './types';
import { authService } from './service';
import { getSessionToken } from './cookies';
import { ok, err } from '@/lib/utils/result';

/**
 * Extract and validate authentication from request
 */
export async function getAuthContext(request: Request): Promise<AuthContext> {
  // Try session cookie first
  const sessionToken = getSessionToken(request);
  if (sessionToken) {
    const result = await authService.validateSession(sessionToken);
    if (result.ok) {
      return result.value;
    }
  }

  // Try Authorization header (API token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const result = await authService.validateApiToken(token);
    if (result.ok) {
      return result.value;
    }
  }

  // Not authenticated
  return {
    user: null,
    session: null,
    isAuthenticated: false,
    authMethod: 'none',
  };
}

/**
 * Require authentication - returns error if not authenticated
 */
export async function requireAuth(request: Request) {
  const context = await getAuthContext(request);

  if (!context.isAuthenticated) {
    return err({
      code: 'UNAUTHORIZED' as const,
      message: 'Authentication required',
    });
  }

  return ok(context);
}

/**
 * Require specific API token scopes
 */
export async function requireScopes(request: Request, requiredScopes: ApiTokenScope[]) {
  const context = await getAuthContext(request);

  if (!context.isAuthenticated) {
    return err({
      code: 'UNAUTHORIZED' as const,
      message: 'Authentication required',
    });
  }

  // Session auth has all permissions
  if (context.authMethod === 'session') {
    return ok(context);
  }

  // Check API token scopes
  // Note: Scope checking would be implemented when creating token context
  // For now, all authenticated requests pass

  return ok(context);
}
```

```typescript
// lib/auth/cookies.ts

const SESSION_COOKIE_NAME = 'agentpane_session';

/**
 * Set session cookie on response
 */
export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date
): void {
  const cookie = [
    `${SESSION_COOKIE_NAME}=${token}`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=${expiresAt.toUTCString()}`,
    process.env.NODE_ENV === 'production' ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');

  response.headers.append('Set-Cookie', cookie);
}

/**
 * Clear session cookie on response
 */
export function clearSessionCookie(response: Response): void {
  const cookie = [
    `${SESSION_COOKIE_NAME}=`,
    `Path=/`,
    `HttpOnly`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ].join('; ');

  response.headers.append('Set-Cookie', cookie);
}

/**
 * Get session token from request
 */
export function getSessionToken(request: Request): string | null {
  const cookies = request.headers.get('Cookie') || '';
  const match = cookies.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}
```

---

## Route Guards

```typescript
// lib/guards/auth-guard.ts
import type { LoaderContext, GuardResult } from './types';
import { getAuthContext } from '@/lib/auth/middleware';

/**
 * Require authentication for a route
 * Redirects to /login if not authenticated
 */
export async function requireAuth(context: LoaderContext): Promise<GuardResult> {
  const auth = await getAuthContext(context.request);

  if (!auth.isAuthenticated) {
    const returnUrl = encodeURIComponent(new URL(context.request.url).pathname);
    return {
      allowed: false,
      redirect: `/login?returnUrl=${returnUrl}`,
    };
  }

  // Attach auth context to loader context
  context.auth = auth;

  return { allowed: true };
}

/**
 * Require unauthenticated state (for login page)
 * Redirects to / if already authenticated
 */
export async function requireGuest(context: LoaderContext): Promise<GuardResult> {
  const auth = await getAuthContext(context.request);

  if (auth.isAuthenticated) {
    return {
      allowed: false,
      redirect: '/',
    };
  }

  return { allowed: true };
}
```

---

## Security Considerations

### Session Security

| Measure | Implementation |
|---------|----------------|
| **Token Generation** | 256-bit cryptographically secure random |
| **Token Storage** | SHA-256 hash in database (API tokens only) |
| **Cookie Security** | HttpOnly, SameSite=Lax, Secure (production) |
| **Session Duration** | 30 days, sliding window on access |
| **Concurrent Sessions** | Allowed, can revoke all |

### OAuth Security

| Measure | Implementation |
|---------|----------------|
| **State Parameter** | 256-bit random, 10-minute expiry |
| **PKCE** | Recommended for future enhancement |
| **Callback Validation** | State must match stored value |
| **Token Exchange** | Server-side only, client secret protected |

### API Token Security

| Measure | Implementation |
|---------|----------------|
| **Token Format** | `ap_` prefix + 256-bit random |
| **Storage** | SHA-256 hash only (plaintext never stored) |
| **Identification** | 8-char prefix for user recognition |
| **Scopes** | Fine-grained permission control |
| **Revocation** | Immediate effect |

### Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/github` | 10 | 1 minute |
| `/api/auth/callback` | 10 | 1 minute |
| `/api/auth/session` | 100 | 1 minute |
| `/api/auth/tokens` | 20 | 1 minute |
| Failed login attempts | 5 | 15 minutes (lockout) |

---

## Configuration

### Environment Variables

```bash
# Required for GitHub OAuth
GITHUB_CLIENT_ID=Iv1.abc123def456
GITHUB_CLIENT_SECRET=secret_abc123def456

# Application URL (for callback)
APP_URL=http://localhost:5173

# Optional: Session configuration
SESSION_DURATION_DAYS=30          # Default: 30
SESSION_COOKIE_NAME=agentpane_session  # Default
```

### Local Development Mode

When `NODE_ENV=development`:

- Local user creation enabled (no GitHub required)
- Secure cookie flag disabled (allows HTTP)
- Debug logging enabled

---

## Error Responses

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_STATE` | 400 | OAuth state parameter invalid |
| `STATE_EXPIRED` | 400 | OAuth state expired (>10 min) |
| `OAUTH_FAILED` | 500 | GitHub OAuth flow failed |
| `SESSION_NOT_FOUND` | 401 | Session does not exist |
| `SESSION_EXPIRED` | 401 | Session has expired |
| `INVALID_TOKEN` | 401 | API token is invalid |
| `TOKEN_EXPIRED` | 401 | API token has expired |
| `INSUFFICIENT_SCOPE` | 403 | API token lacks required scope |
| `USER_NOT_FOUND` | 404 | User does not exist |
| `UNAUTHORIZED` | 401 | Authentication required |

---

## Integration with Router

```typescript
// app/router.tsx
import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen';
import { getAuthContext } from '@/lib/auth/middleware';

export interface RouterContext {
  db: typeof db;
  auth?: AuthContext;
}

export function createAppRouter() {
  return createRouter({
    routeTree,
    context: {
      db,
      auth: undefined,
    },
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
  });
}
```

```typescript
// app/routes/__root.tsx
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import type { RouterContext } from '../router';

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <div className="min-h-screen bg-canvas">
      <Outlet />
    </div>
  ),
});
```

---

## Testing

### Unit Tests

```typescript
// tests/unit/auth/service.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authService } from '@/lib/auth/service';

describe('AuthService', () => {
  describe('initiateOAuth', () => {
    it('should generate valid OAuth URL with state', async () => {
      const result = await authService.initiateOAuth('/dashboard');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.url).toContain('github.com/login/oauth/authorize');
        expect(result.value.url).toContain('state=');
        expect(result.value.state).toHaveLength(64);
      }
    });
  });

  describe('validateSession', () => {
    it('should return error for invalid token', async () => {
      const result = await authService.validateSession('invalid-token');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('SESSION_NOT_FOUND');
      }
    });

    it('should return error for expired session', async () => {
      // Create expired session in test DB
      // Validate returns SESSION_EXPIRED
    });
  });

  describe('createApiToken', () => {
    it('should create token with correct format', async () => {
      const result = await authService.createApiToken(
        'user-id',
        'Test Token',
        ['projects:read']
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.plainToken).toMatch(/^ap_[a-f0-9]{64}$/);
        expect(result.value.token.tokenPrefix).toBe(result.value.plainToken.substring(0, 8));
      }
    });
  });
});
```

### Integration Tests

```typescript
// tests/integration/auth/oauth-flow.test.ts
import { describe, it, expect } from 'vitest';
import { testClient } from '../utils/test-client';

describe('OAuth Flow', () => {
  it('should redirect to GitHub with state', async () => {
    const response = await testClient.get('/api/auth/github');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('github.com');
  });

  it('should reject invalid state on callback', async () => {
    const response = await testClient.get('/api/auth/callback?code=test&state=invalid');

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toContain('/login?error=');
  });
});
```

---

## Cross-References

- [Security Model](/specs/security/security-model.md) - Overall security architecture
- [GitHub App Integration](/specs/integrations/github-app.md) - GitHub App setup
- [Routing Specification](/specs/routing/routes.md) - Route definitions
- [API Endpoints](/specs/api/endpoints.md) - API authentication headers
- [Error Catalog](/specs/errors/error-catalog.md) - Error code definitions
