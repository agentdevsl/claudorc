# Application Bootstrap Specification

## Overview

Complete specification for the AgentPane application bootstrap process. This document covers the initialization sequence for PGlite database, Drizzle ORM schema validation, TanStack DB collections, Durable Streams client connection, GitHub token validation, and first-run data seeding with comprehensive error recovery.

---

## Technology Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| Bun | 1.3.6 | JavaScript runtime |
| TanStack Start | 1.150.0 | Full-stack React framework |
| PGlite | 0.3.15 | Embedded PostgreSQL (IndexedDB) |
| Drizzle ORM | 0.45.1 | Type-safe SQL query builder |
| TanStack DB | 0.5.20 | Client-side reactive collections |
| TanStack React DB | 0.1.64 | React bindings for live queries |
| Durable Streams | 0.1.5 | Real-time event streaming |

---

## Interface Definition

```typescript
// lib/bootstrap/types.ts
import type { Result } from '@/lib/utils/result';

/**
 * Result type pattern for error handling
 */
export type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/**
 * Bootstrap phase identifiers
 */
export type BootstrapPhase =
  | 'pglite'
  | 'schema'
  | 'collections'
  | 'streams'
  | 'github'
  | 'seeding';

/**
 * Bootstrap status for each phase
 */
export type PhaseStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

/**
 * Individual phase result
 */
export interface PhaseResult<T = unknown> {
  phase: BootstrapPhase;
  status: PhaseStatus;
  duration: number;
  data?: T;
  error?: BootstrapError;
}

/**
 * Complete bootstrap result
 */
export interface BootstrapResult {
  success: boolean;
  duration: number;
  phases: PhaseResult[];
  isFirstRun: boolean;
}

/**
 * Bootstrap error categories
 */
export type BootstrapErrorCode =
  | 'INDEXEDDB_UNAVAILABLE'
  | 'PGLITE_INIT_FAILED'
  | 'SCHEMA_MIGRATION_FAILED'
  | 'SCHEMA_VALIDATION_FAILED'
  | 'COLLECTION_INIT_FAILED'
  | 'STREAMS_CONNECTION_FAILED'
  | 'GITHUB_TOKEN_INVALID'
  | 'GITHUB_TOKEN_EXPIRED'
  | 'SEEDING_FAILED'
  | 'RECOVERY_FAILED';

/**
 * Bootstrap error structure
 */
export interface BootstrapError {
  code: BootstrapErrorCode;
  message: string;
  phase: BootstrapPhase;
  recoverable: boolean;
  details?: Record<string, unknown>;
}

/**
 * Bootstrap configuration options
 */
export interface BootstrapConfig {
  /** IndexedDB database name */
  databaseName: string;
  /** Skip GitHub validation if token not present */
  skipGitHubIfMissing: boolean;
  /** Maximum retries for recoverable errors */
  maxRetries: number;
  /** Retry delay in milliseconds */
  retryDelayMs: number;
  /** Timeout for each phase in milliseconds */
  phaseTimeoutMs: number;
  /** Enable verbose logging */
  debug: boolean;
}

/**
 * Default bootstrap configuration
 */
export const DEFAULT_BOOTSTRAP_CONFIG: BootstrapConfig = {
  databaseName: 'idb://agentpane',
  skipGitHubIfMissing: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  phaseTimeoutMs: 30000,
  debug: false,
};

/**
 * Bootstrap service interface
 */
export interface IBootstrapService {
  /** Initialize the application */
  initialize(config?: Partial<BootstrapConfig>): Promise<Result<BootstrapResult, BootstrapError>>;

  /** Get current bootstrap status */
  getStatus(): BootstrapStatus;

  /** Retry a failed phase */
  retryPhase(phase: BootstrapPhase): Promise<Result<PhaseResult, BootstrapError>>;

  /** Reset and reinitialize */
  reset(): Promise<Result<BootstrapResult, BootstrapError>>;

  /** Check if database is available */
  checkDatabaseAvailability(): Promise<Result<boolean, BootstrapError>>;
}

/**
 * Current bootstrap status
 */
export interface BootstrapStatus {
  isInitialized: boolean;
  isInitializing: boolean;
  currentPhase: BootstrapPhase | null;
  completedPhases: BootstrapPhase[];
  failedPhase: BootstrapPhase | null;
  error: BootstrapError | null;
}
```

---

## Initialization Sequence

The bootstrap process follows a strict sequential order with error handling at each phase.

### Phase Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Bootstrap                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 1: PGlite Initialization                                  │
│  ├─ Check IndexedDB availability                                │
│  ├─ Initialize PGlite with 'idb://agentpane'                    │
│  └─ Verify connection                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 2: Drizzle Schema Validation/Migration                    │
│  ├─ Check schema version                                         │
│  ├─ Run pending migrations                                       │
│  └─ Validate schema integrity                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 3: TanStack DB Collection Setup                           │
│  ├─ Initialize agents collection                                 │
│  ├─ Initialize tasks collection                                  │
│  ├─ Initialize projects collection                               │
│  └─ Initialize sessions collection                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 4: Durable Streams Connection                             │
│  ├─ Initialize client                                            │
│  ├─ Establish connection                                         │
│  └─ Verify heartbeat                                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 5: GitHub Token Validation (Optional)                     │
│  ├─ Check for stored token                                       │
│  ├─ Validate token with GitHub API                               │
│  └─ Refresh if expired (if refresh token available)              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Phase 6: Default Data Seeding (First Run Only)                  │
│  ├─ Check if first run                                           │
│  ├─ Create default project (if none exists)                      │
│  └─ Set first-run flag                                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Bootstrap Complete                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: PGlite Initialization

Initialize the PGlite database with IndexedDB persistence for Safari compatibility.

```typescript
// lib/bootstrap/phases/pglite.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@/db/schema';
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';

/**
 * Check if IndexedDB is available
 * Returns false in private browsing mode on Safari
 */
async function checkIndexedDBAvailability(): Promise<boolean> {
  if (typeof window === 'undefined') {
    // Server-side, IndexedDB not needed
    return true;
  }

  if (!window.indexedDB) {
    return false;
  }

  // Test actual availability (private browsing check)
  try {
    const testDb = window.indexedDB.open('__idb_test__');

    return new Promise((resolve) => {
      testDb.onerror = () => resolve(false);
      testDb.onsuccess = () => {
        testDb.result.close();
        window.indexedDB.deleteDatabase('__idb_test__');
        resolve(true);
      };
    });
  } catch {
    return false;
  }
}

/**
 * PGlite database instance (singleton)
 */
let pgliteInstance: PGlite | null = null;
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize PGlite database
 */
export async function initializePGlite(
  config: BootstrapConfig
): Promise<Result<PhaseResult<{ pglite: PGlite; db: ReturnType<typeof drizzle> }>, BootstrapError>> {
  const startTime = Date.now();

  try {
    // Check IndexedDB availability (client-side only)
    if (typeof window !== 'undefined') {
      const isAvailable = await checkIndexedDBAvailability();

      if (!isAvailable) {
        return err({
          code: 'INDEXEDDB_UNAVAILABLE',
          message: 'IndexedDB is not available. This may be due to private browsing mode.',
          phase: 'pglite',
          recoverable: false,
          details: {
            hint: 'Please disable private browsing or use a different browser.',
            browsers: ['Safari Private Mode', 'Firefox Private Mode (some versions)'],
          },
        });
      }
    }

    // Initialize PGlite
    if (config.debug) {
      console.log('[Bootstrap] Initializing PGlite with:', config.databaseName);
    }

    pgliteInstance = new PGlite(config.databaseName);

    // Wait for ready state
    await pgliteInstance.waitReady;

    // Initialize Drizzle ORM
    drizzleInstance = drizzle(pgliteInstance, { schema });

    // Verify connection with a simple query
    await pgliteInstance.query('SELECT 1 as health_check');

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] PGlite initialized in ${duration}ms`);
    }

    return ok({
      phase: 'pglite',
      status: 'completed',
      duration,
      data: {
        pglite: pgliteInstance,
        db: drizzleInstance,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'PGLITE_INIT_FAILED',
      message: `Failed to initialize PGlite: ${errorMessage}`,
      phase: 'pglite',
      recoverable: true,
      details: {
        databaseName: config.databaseName,
        error: errorMessage,
      },
    });
  }
}

/**
 * Get the initialized PGlite instance
 */
export function getPGlite(): PGlite | null {
  return pgliteInstance;
}

/**
 * Get the initialized Drizzle instance
 */
export function getDb(): ReturnType<typeof drizzle> | null {
  return drizzleInstance;
}

/**
 * Export database client for use throughout the application
 */
export const db = {
  get instance() {
    if (!drizzleInstance) {
      throw new Error('Database not initialized. Call bootstrap.initialize() first.');
    }
    return drizzleInstance;
  },
};
```

---

## Phase 2: Schema Validation and Migration

Validate and migrate the Drizzle ORM schema.

```typescript
// lib/bootstrap/phases/schema.ts
import { migrate } from 'drizzle-orm/pglite/migrator';
import { sql } from 'drizzle-orm';
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';
import { getDb } from './pglite';

/**
 * Schema version tracking
 */
interface SchemaVersion {
  version: number;
  appliedAt: Date;
  checksum: string;
}

/**
 * Validate schema and run migrations
 */
export async function validateAndMigrateSchema(
  config: BootstrapConfig
): Promise<Result<PhaseResult<{ version: number; migrationsApplied: number }>, BootstrapError>> {
  const startTime = Date.now();
  const db = getDb();

  if (!db) {
    return err({
      code: 'SCHEMA_VALIDATION_FAILED',
      message: 'Database not initialized',
      phase: 'schema',
      recoverable: false,
    });
  }

  try {
    if (config.debug) {
      console.log('[Bootstrap] Validating schema and running migrations...');
    }

    // Create migrations table if it doesn't exist
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS __drizzle_migrations (
        id SERIAL PRIMARY KEY,
        hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Get current migration count
    const beforeMigrations = await db.execute(sql`
      SELECT COUNT(*) as count FROM __drizzle_migrations
    `);
    const beforeCount = Number(beforeMigrations.rows[0]?.count ?? 0);

    // Run migrations
    // In production, migrations are pre-compiled in the migrations folder
    await migrate(db, {
      migrationsFolder: './db/migrations',
    });

    // Get migration count after
    const afterMigrations = await db.execute(sql`
      SELECT COUNT(*) as count FROM __drizzle_migrations
    `);
    const afterCount = Number(afterMigrations.rows[0]?.count ?? 0);

    const migrationsApplied = afterCount - beforeCount;

    // Validate schema integrity by checking all required tables exist
    const requiredTables = [
      'projects',
      'tasks',
      'agents',
      'agent_runs',
      'sessions',
      'worktrees',
      'audit_logs',
      'github_installations',
      'repository_configs',
    ];

    for (const table of requiredTables) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = ${table}
        ) as exists
      `);

      if (!result.rows[0]?.exists) {
        return err({
          code: 'SCHEMA_VALIDATION_FAILED',
          message: `Required table "${table}" not found after migration`,
          phase: 'schema',
          recoverable: false,
          details: { missingTable: table },
        });
      }
    }

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] Schema validated in ${duration}ms, ${migrationsApplied} migrations applied`);
    }

    return ok({
      phase: 'schema',
      status: 'completed',
      duration,
      data: {
        version: afterCount,
        migrationsApplied,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'SCHEMA_MIGRATION_FAILED',
      message: `Schema migration failed: ${errorMessage}`,
      phase: 'schema',
      recoverable: false,
      details: {
        error: errorMessage,
        hint: 'Database may be corrupted. Consider resetting with bootstrap.reset()',
      },
    });
  }
}
```

---

## Phase 3: TanStack DB Collection Setup

Initialize TanStack DB collections for client-side reactive state.

```typescript
// lib/bootstrap/phases/collections.ts
import { createCollection } from '@tanstack/db';
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';
import type { Agent, Task, Project, Session } from '@/db/schema';

/**
 * Collection instances
 */
export const agentsCollection = createCollection<Agent>({
  id: 'agents',
  primaryKey: 'id',
});

export const tasksCollection = createCollection<Task>({
  id: 'tasks',
  primaryKey: 'id',
});

export const projectsCollection = createCollection<Project>({
  id: 'projects',
  primaryKey: 'id',
});

export const sessionsCollection = createCollection<Session>({
  id: 'sessions',
  primaryKey: 'id',
});

/**
 * Collection registry for bulk operations
 */
export const collections = {
  agents: agentsCollection,
  tasks: tasksCollection,
  projects: projectsCollection,
  sessions: sessionsCollection,
} as const;

/**
 * Initialize all TanStack DB collections
 */
export async function initializeCollections(
  config: BootstrapConfig
): Promise<Result<PhaseResult<{ collections: typeof collections }>, BootstrapError>> {
  const startTime = Date.now();

  try {
    if (config.debug) {
      console.log('[Bootstrap] Initializing TanStack DB collections...');
    }

    // Collections are created on module load, but we verify they're ready
    const collectionNames = Object.keys(collections);

    for (const name of collectionNames) {
      const collection = collections[name as keyof typeof collections];

      // Verify collection is accessible
      if (!collection) {
        return err({
          code: 'COLLECTION_INIT_FAILED',
          message: `Collection "${name}" failed to initialize`,
          phase: 'collections',
          recoverable: true,
          details: { collectionName: name },
        });
      }
    }

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] ${collectionNames.length} collections initialized in ${duration}ms`);
    }

    return ok({
      phase: 'collections',
      status: 'completed',
      duration,
      data: { collections },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'COLLECTION_INIT_FAILED',
      message: `Failed to initialize collections: ${errorMessage}`,
      phase: 'collections',
      recoverable: true,
      details: { error: errorMessage },
    });
  }
}
```

---

## Phase 4: Durable Streams Connection

Establish connection to Durable Streams for real-time event streaming.

```typescript
// lib/bootstrap/phases/streams.ts
import { DurableStreamsClient } from '@durable-streams/client';
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';
import { sessionSchema } from '@/lib/sessions/schema';

/**
 * Durable Streams client instance
 */
let streamsClient: DurableStreamsClient | null = null;

/**
 * Initialize Durable Streams client
 */
export async function initializeStreams(
  config: BootstrapConfig
): Promise<Result<PhaseResult<{ client: DurableStreamsClient }>, BootstrapError>> {
  const startTime = Date.now();

  try {
    if (config.debug) {
      console.log('[Bootstrap] Initializing Durable Streams client...');
    }

    // Initialize client
    streamsClient = new DurableStreamsClient({
      url: '/api/streams',
      schema: sessionSchema,
      reconnect: {
        enabled: true,
        initialDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
      },
    });

    // Wait for initial connection with timeout
    const connectionPromise = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, config.phaseTimeoutMs);

      streamsClient!.on('connected', () => {
        clearTimeout(timeout);
        resolve();
      });

      streamsClient!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      // Initiate connection
      streamsClient!.connect();
    });

    await connectionPromise;

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] Durable Streams connected in ${duration}ms`);
    }

    return ok({
      phase: 'streams',
      status: 'completed',
      duration,
      data: { client: streamsClient },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'STREAMS_CONNECTION_FAILED',
      message: `Failed to connect to Durable Streams: ${errorMessage}`,
      phase: 'streams',
      recoverable: true,
      details: {
        error: errorMessage,
        hint: 'Check network connectivity and server status',
      },
    });
  }
}

/**
 * Get the Durable Streams client
 */
export function getStreamsClient(): DurableStreamsClient | null {
  return streamsClient;
}
```

---

## Phase 5: GitHub Token Validation

Validate GitHub token if configured.

```typescript
// lib/bootstrap/phases/github.ts
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';

interface GitHubTokenInfo {
  isValid: boolean;
  scopes: string[];
  expiresAt: Date | null;
  username: string;
}

/**
 * Validate GitHub token
 */
export async function validateGitHubToken(
  config: BootstrapConfig
): Promise<Result<PhaseResult<GitHubTokenInfo | null>, BootstrapError>> {
  const startTime = Date.now();

  try {
    // Get token from environment or storage
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('github_token')
      : process.env.GITHUB_TOKEN;

    // Skip if no token and configured to skip
    if (!token && config.skipGitHubIfMissing) {
      const duration = Date.now() - startTime;

      if (config.debug) {
        console.log('[Bootstrap] GitHub token not found, skipping validation');
      }

      return ok({
        phase: 'github',
        status: 'skipped',
        duration,
        data: null,
      });
    }

    // No token and not configured to skip
    if (!token) {
      return err({
        code: 'GITHUB_TOKEN_INVALID',
        message: 'GitHub token not configured',
        phase: 'github',
        recoverable: true,
        details: {
          hint: 'Set up GitHub integration in project settings',
        },
      });
    }

    if (config.debug) {
      console.log('[Bootstrap] Validating GitHub token...');
    }

    // Validate token with GitHub API
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return err({
          code: 'GITHUB_TOKEN_INVALID',
          message: 'GitHub token is invalid or revoked',
          phase: 'github',
          recoverable: true,
          details: {
            status: response.status,
            hint: 'Please re-authenticate with GitHub',
          },
        });
      }

      if (response.status === 403) {
        const rateLimitReset = response.headers.get('X-RateLimit-Reset');

        return err({
          code: 'GITHUB_TOKEN_EXPIRED',
          message: 'GitHub API rate limit exceeded',
          phase: 'github',
          recoverable: true,
          details: {
            status: response.status,
            resetAt: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toISOString() : null,
          },
        });
      }

      throw new Error(`GitHub API error: ${response.status}`);
    }

    const userData = await response.json();

    // Parse scopes from response headers
    const scopesHeader = response.headers.get('X-OAuth-Scopes');
    const scopes = scopesHeader ? scopesHeader.split(', ') : [];

    // Check for required scopes
    const requiredScopes = ['repo', 'read:org'];
    const missingScopes = requiredScopes.filter(s => !scopes.includes(s));

    if (missingScopes.length > 0) {
      if (config.debug) {
        console.warn('[Bootstrap] GitHub token missing scopes:', missingScopes);
      }
    }

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] GitHub token validated in ${duration}ms for user: ${userData.login}`);
    }

    return ok({
      phase: 'github',
      status: 'completed',
      duration,
      data: {
        isValid: true,
        scopes,
        expiresAt: null, // GitHub tokens don't have built-in expiry
        username: userData.login,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'GITHUB_TOKEN_INVALID',
      message: `GitHub token validation failed: ${errorMessage}`,
      phase: 'github',
      recoverable: true,
      details: { error: errorMessage },
    });
  }
}
```

---

## Phase 6: Default Data Seeding

Seed default data on first run.

```typescript
// lib/bootstrap/phases/seeding.ts
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import { ok, err, type Result } from '@/lib/utils/result';
import type { PhaseResult, BootstrapError, BootstrapConfig } from '../types';
import { getDb } from './pglite';
import { projects, agents } from '@/db/schema';

/**
 * First run flag key in metadata
 */
const FIRST_RUN_KEY = '__agentpane_first_run_complete';

/**
 * Check if this is the first run
 */
async function isFirstRun(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  return localStorage.getItem(FIRST_RUN_KEY) !== 'true';
}

/**
 * Mark first run as complete
 */
function markFirstRunComplete(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(FIRST_RUN_KEY, 'true');
  }
}

/**
 * Seed default data on first run
 */
export async function seedDefaultData(
  config: BootstrapConfig
): Promise<Result<PhaseResult<{ seeded: boolean; projectId?: string }>, BootstrapError>> {
  const startTime = Date.now();
  const db = getDb();

  if (!db) {
    return err({
      code: 'SEEDING_FAILED',
      message: 'Database not initialized',
      phase: 'seeding',
      recoverable: false,
    });
  }

  try {
    // Check if first run
    const firstRun = await isFirstRun();

    if (!firstRun) {
      const duration = Date.now() - startTime;

      if (config.debug) {
        console.log('[Bootstrap] Not first run, skipping seeding');
      }

      return ok({
        phase: 'seeding',
        status: 'skipped',
        duration,
        data: { seeded: false },
      });
    }

    if (config.debug) {
      console.log('[Bootstrap] First run detected, seeding default data...');
    }

    // Check if any projects exist (user may have imported data)
    const existingProjects = await db.select().from(projects).limit(1);

    if (existingProjects.length > 0) {
      markFirstRunComplete();
      const duration = Date.now() - startTime;

      if (config.debug) {
        console.log('[Bootstrap] Existing projects found, skipping seeding');
      }

      return ok({
        phase: 'seeding',
        status: 'skipped',
        duration,
        data: { seeded: false },
      });
    }

    // Create default project
    const projectId = createId();
    const defaultProjectPath = process.cwd() || '~/projects/my-project';

    await db.insert(projects).values({
      id: projectId,
      name: 'My First Project',
      path: defaultProjectPath,
      description: 'Welcome to AgentPane! This is your first project.',
      config: {
        worktreeRoot: '.worktrees',
        defaultBranch: 'main',
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        maxTurns: 50,
        model: 'claude-sonnet-4-20250514',
      },
      maxConcurrentAgents: 3,
    });

    // Create default agent
    const agentId = createId();

    await db.insert(agents).values({
      id: agentId,
      projectId,
      name: 'Default Agent',
      type: 'task',
      status: 'idle',
      config: {
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
        maxTurns: 50,
        model: 'claude-sonnet-4-20250514',
      },
    });

    // Mark first run complete
    markFirstRunComplete();

    const duration = Date.now() - startTime;

    if (config.debug) {
      console.log(`[Bootstrap] Default data seeded in ${duration}ms`);
    }

    return ok({
      phase: 'seeding',
      status: 'completed',
      duration,
      data: {
        seeded: true,
        projectId,
      },
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    return err({
      code: 'SEEDING_FAILED',
      message: `Failed to seed default data: ${errorMessage}`,
      phase: 'seeding',
      recoverable: true,
      details: { error: errorMessage },
    });
  }
}
```

---

## Error Handling

### Error Recovery Strategies

```typescript
// lib/bootstrap/recovery.ts
import type { BootstrapError, BootstrapPhase, BootstrapConfig } from './types';
import { initializePGlite } from './phases/pglite';
import { validateAndMigrateSchema } from './phases/schema';
import { initializeCollections } from './phases/collections';
import { initializeStreams } from './phases/streams';
import { validateGitHubToken } from './phases/github';
import { seedDefaultData } from './phases/seeding';

/**
 * Recovery strategies for each error type
 */
export const recoveryStrategies: Record<
  BootstrapError['code'],
  (config: BootstrapConfig, attempt: number) => Promise<boolean>
> = {
  // IndexedDB unavailable - cannot recover automatically
  INDEXEDDB_UNAVAILABLE: async () => false,

  // PGlite init failed - retry with exponential backoff
  PGLITE_INIT_FAILED: async (config, attempt) => {
    const delay = config.retryDelayMs * Math.pow(2, attempt);
    await sleep(delay);
    return attempt < config.maxRetries;
  },

  // Schema migration failed - cannot recover, needs manual intervention
  SCHEMA_MIGRATION_FAILED: async () => false,

  // Schema validation failed - cannot recover
  SCHEMA_VALIDATION_FAILED: async () => false,

  // Collection init failed - retry
  COLLECTION_INIT_FAILED: async (config, attempt) => {
    await sleep(config.retryDelayMs);
    return attempt < config.maxRetries;
  },

  // Streams connection failed - retry with backoff
  STREAMS_CONNECTION_FAILED: async (config, attempt) => {
    const delay = config.retryDelayMs * Math.pow(2, attempt);
    await sleep(delay);
    return attempt < config.maxRetries;
  },

  // GitHub token invalid - skip (handled by UI)
  GITHUB_TOKEN_INVALID: async () => true,

  // GitHub token expired - skip (handled by UI)
  GITHUB_TOKEN_EXPIRED: async () => true,

  // Seeding failed - retry once
  SEEDING_FAILED: async (config, attempt) => {
    await sleep(config.retryDelayMs);
    return attempt < 1;
  },

  // Recovery failed - cannot recover
  RECOVERY_FAILED: async () => false,
};

/**
 * Phase retry functions
 */
export const phaseRetryFunctions: Record<
  BootstrapPhase,
  (config: BootstrapConfig) => Promise<unknown>
> = {
  pglite: initializePGlite,
  schema: validateAndMigrateSchema,
  collections: initializeCollections,
  streams: initializeStreams,
  github: validateGitHubToken,
  seeding: seedDefaultData,
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Attempt to recover from a bootstrap error
 */
export async function attemptRecovery(
  error: BootstrapError,
  config: BootstrapConfig,
  attempt: number
): Promise<{ canRetry: boolean; shouldSkip: boolean }> {
  if (!error.recoverable) {
    return { canRetry: false, shouldSkip: false };
  }

  const strategy = recoveryStrategies[error.code];

  if (!strategy) {
    return { canRetry: false, shouldSkip: false };
  }

  const canRetry = await strategy(config, attempt);

  // Special handling for GitHub errors - skip rather than fail
  const shouldSkip = error.code === 'GITHUB_TOKEN_INVALID' ||
                     error.code === 'GITHUB_TOKEN_EXPIRED';

  return { canRetry, shouldSkip };
}
```

### Bootstrap Error Types

```typescript
// lib/errors/bootstrap-errors.ts
import { createError, type AppError } from './base';

export const BootstrapErrors = {
  INDEXEDDB_UNAVAILABLE: createError(
    'INDEXEDDB_UNAVAILABLE',
    'IndexedDB is not available. This may be due to private browsing mode.',
    503
  ),

  PGLITE_INIT_FAILED: (error: string) => createError(
    'PGLITE_INIT_FAILED',
    `Failed to initialize database: ${error}`,
    500,
    { error }
  ),

  SCHEMA_MIGRATION_FAILED: (error: string) => createError(
    'SCHEMA_MIGRATION_FAILED',
    `Database migration failed: ${error}`,
    500,
    { error, hint: 'Database may need to be reset' }
  ),

  SCHEMA_VALIDATION_FAILED: (table: string) => createError(
    'SCHEMA_VALIDATION_FAILED',
    `Schema validation failed: missing table "${table}"`,
    500,
    { missingTable: table }
  ),

  COLLECTION_INIT_FAILED: (collection: string) => createError(
    'COLLECTION_INIT_FAILED',
    `Failed to initialize collection: ${collection}`,
    500,
    { collection }
  ),

  STREAMS_CONNECTION_FAILED: (error: string) => createError(
    'STREAMS_CONNECTION_FAILED',
    `Failed to connect to real-time streams: ${error}`,
    502,
    { error }
  ),

  GITHUB_TOKEN_INVALID: createError(
    'GITHUB_TOKEN_INVALID',
    'GitHub token is invalid or has been revoked',
    401
  ),

  GITHUB_TOKEN_EXPIRED: (resetAt: string) => createError(
    'GITHUB_TOKEN_EXPIRED',
    'GitHub API rate limit exceeded',
    429,
    { resetAt }
  ),

  SEEDING_FAILED: (error: string) => createError(
    'SEEDING_FAILED',
    `Failed to seed initial data: ${error}`,
    500,
    { error }
  ),

  RECOVERY_FAILED: (phase: string, attempts: number) => createError(
    'RECOVERY_FAILED',
    `Bootstrap recovery failed for phase "${phase}" after ${attempts} attempts`,
    500,
    { phase, attempts }
  ),
} as const;

export type BootstrapError =
  | typeof BootstrapErrors.INDEXEDDB_UNAVAILABLE
  | ReturnType<typeof BootstrapErrors.PGLITE_INIT_FAILED>
  | ReturnType<typeof BootstrapErrors.SCHEMA_MIGRATION_FAILED>
  | ReturnType<typeof BootstrapErrors.SCHEMA_VALIDATION_FAILED>
  | ReturnType<typeof BootstrapErrors.COLLECTION_INIT_FAILED>
  | ReturnType<typeof BootstrapErrors.STREAMS_CONNECTION_FAILED>
  | typeof BootstrapErrors.GITHUB_TOKEN_INVALID
  | ReturnType<typeof BootstrapErrors.GITHUB_TOKEN_EXPIRED>
  | ReturnType<typeof BootstrapErrors.SEEDING_FAILED>
  | ReturnType<typeof BootstrapErrors.RECOVERY_FAILED>;
```

---

## Implementation Outline

### Bootstrap Service

```typescript
// lib/bootstrap/service.ts
import { ok, err, type Result } from '@/lib/utils/result';
import {
  type IBootstrapService,
  type BootstrapConfig,
  type BootstrapResult,
  type BootstrapStatus,
  type BootstrapPhase,
  type PhaseResult,
  type BootstrapError,
  DEFAULT_BOOTSTRAP_CONFIG,
} from './types';
import { initializePGlite, getPGlite } from './phases/pglite';
import { validateAndMigrateSchema } from './phases/schema';
import { initializeCollections } from './phases/collections';
import { initializeStreams } from './phases/streams';
import { validateGitHubToken } from './phases/github';
import { seedDefaultData } from './phases/seeding';
import { attemptRecovery, phaseRetryFunctions } from './recovery';

/**
 * Bootstrap service implementation
 */
class BootstrapService implements IBootstrapService {
  private status: BootstrapStatus = {
    isInitialized: false,
    isInitializing: false,
    currentPhase: null,
    completedPhases: [],
    failedPhase: null,
    error: null,
  };

  private config: BootstrapConfig = DEFAULT_BOOTSTRAP_CONFIG;
  private phaseResults: PhaseResult[] = [];

  /**
   * Initialize the application
   */
  async initialize(
    configOverrides?: Partial<BootstrapConfig>
  ): Promise<Result<BootstrapResult, BootstrapError>> {
    // Prevent concurrent initialization
    if (this.status.isInitializing) {
      return err({
        code: 'RECOVERY_FAILED',
        message: 'Bootstrap already in progress',
        phase: 'pglite',
        recoverable: false,
      });
    }

    // Apply config overrides
    this.config = { ...DEFAULT_BOOTSTRAP_CONFIG, ...configOverrides };

    this.status.isInitializing = true;
    this.status.error = null;
    this.phaseResults = [];

    const startTime = Date.now();

    // Execute phases in sequence
    const phases: Array<{
      name: BootstrapPhase;
      execute: (config: BootstrapConfig) => Promise<Result<PhaseResult, BootstrapError>>;
    }> = [
      { name: 'pglite', execute: initializePGlite },
      { name: 'schema', execute: validateAndMigrateSchema },
      { name: 'collections', execute: initializeCollections },
      { name: 'streams', execute: initializeStreams },
      { name: 'github', execute: validateGitHubToken },
      { name: 'seeding', execute: seedDefaultData },
    ];

    let isFirstRun = false;

    for (const phase of phases) {
      this.status.currentPhase = phase.name;
      let attempt = 0;
      let result: Result<PhaseResult, BootstrapError>;

      do {
        result = await phase.execute(this.config);

        if (!result.ok) {
          const recovery = await attemptRecovery(result.error, this.config, attempt);

          if (recovery.shouldSkip) {
            // Convert error to skipped phase
            this.phaseResults.push({
              phase: phase.name,
              status: 'skipped',
              duration: 0,
              error: result.error,
            });
            this.status.completedPhases.push(phase.name);
            break;
          }

          if (!recovery.canRetry) {
            this.status.failedPhase = phase.name;
            this.status.error = result.error;
            this.status.isInitializing = false;
            return result;
          }

          attempt++;
        }
      } while (!result.ok && attempt <= this.config.maxRetries);

      if (result.ok) {
        this.phaseResults.push(result.value);
        this.status.completedPhases.push(phase.name);

        // Track first run from seeding phase
        if (phase.name === 'seeding' && result.value.data?.seeded) {
          isFirstRun = true;
        }
      }
    }

    // Bootstrap complete
    this.status.isInitialized = true;
    this.status.isInitializing = false;
    this.status.currentPhase = null;

    const totalDuration = Date.now() - startTime;

    if (this.config.debug) {
      console.log(`[Bootstrap] Complete in ${totalDuration}ms`);
    }

    return ok({
      success: true,
      duration: totalDuration,
      phases: this.phaseResults,
      isFirstRun,
    });
  }

  /**
   * Get current bootstrap status
   */
  getStatus(): BootstrapStatus {
    return { ...this.status };
  }

  /**
   * Retry a failed phase
   */
  async retryPhase(phase: BootstrapPhase): Promise<Result<PhaseResult, BootstrapError>> {
    const retryFn = phaseRetryFunctions[phase];

    if (!retryFn) {
      return err({
        code: 'RECOVERY_FAILED',
        message: `Unknown phase: ${phase}`,
        phase,
        recoverable: false,
      });
    }

    this.status.currentPhase = phase;
    const result = await retryFn(this.config);

    if (result.ok) {
      this.status.failedPhase = null;
      this.status.error = null;
      this.status.completedPhases.push(phase);
    }

    this.status.currentPhase = null;
    return result as Result<PhaseResult, BootstrapError>;
  }

  /**
   * Reset and reinitialize
   */
  async reset(): Promise<Result<BootstrapResult, BootstrapError>> {
    // Clear stored data
    if (typeof window !== 'undefined') {
      // Remove IndexedDB database
      await new Promise<void>((resolve, reject) => {
        const request = window.indexedDB.deleteDatabase('agentpane');
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      // Clear local storage
      localStorage.removeItem('__agentpane_first_run_complete');
      localStorage.removeItem('github_token');
    }

    // Reset status
    this.status = {
      isInitialized: false,
      isInitializing: false,
      currentPhase: null,
      completedPhases: [],
      failedPhase: null,
      error: null,
    };

    // Reinitialize
    return this.initialize(this.config);
  }

  /**
   * Check if database is available
   */
  async checkDatabaseAvailability(): Promise<Result<boolean, BootstrapError>> {
    const pglite = getPGlite();

    if (!pglite) {
      return ok(false);
    }

    try {
      await pglite.query('SELECT 1');
      return ok(true);
    } catch {
      return ok(false);
    }
  }
}

// Export singleton instance
export const bootstrap = new BootstrapService();
```

### React Integration

```typescript
// lib/bootstrap/hooks.ts
import { useEffect, useState, useCallback } from 'react';
import { bootstrap } from './service';
import type { BootstrapStatus, BootstrapResult, BootstrapConfig } from './types';

/**
 * Hook for bootstrap status
 */
export function useBootstrap(config?: Partial<BootstrapConfig>) {
  const [status, setStatus] = useState<BootstrapStatus>(bootstrap.getStatus());
  const [result, setResult] = useState<BootstrapResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Already initialized
    if (status.isInitialized) {
      return;
    }

    // Initialize
    bootstrap.initialize(config).then((res) => {
      if (res.ok) {
        setResult(res.value);
      } else {
        setError(new Error(res.error.message));
      }
      setStatus(bootstrap.getStatus());
    });
  }, [config]);

  const retry = useCallback(async () => {
    if (status.failedPhase) {
      const res = await bootstrap.retryPhase(status.failedPhase);
      setStatus(bootstrap.getStatus());
      return res;
    }
    return null;
  }, [status.failedPhase]);

  const reset = useCallback(async () => {
    const res = await bootstrap.reset();
    if (res.ok) {
      setResult(res.value);
      setError(null);
    } else {
      setError(new Error(res.error.message));
    }
    setStatus(bootstrap.getStatus());
    return res;
  }, []);

  return {
    status,
    result,
    error,
    isReady: status.isInitialized,
    isLoading: status.isInitializing,
    retry,
    reset,
  };
}
```

### Bootstrap Provider

```typescript
// app/providers/bootstrap-provider.tsx
import { createContext, useContext, type ReactNode } from 'react';
import { useBootstrap } from '@/lib/bootstrap/hooks';
import type { BootstrapStatus, BootstrapResult } from '@/lib/bootstrap/types';

interface BootstrapContextValue {
  status: BootstrapStatus;
  result: BootstrapResult | null;
  error: Error | null;
  isReady: boolean;
  isLoading: boolean;
  retry: () => Promise<unknown>;
  reset: () => Promise<unknown>;
}

const BootstrapContext = createContext<BootstrapContextValue | null>(null);

export function BootstrapProvider({ children }: { children: ReactNode }) {
  const bootstrap = useBootstrap();

  // Show loading state during initialization
  if (bootstrap.isLoading) {
    return <BootstrapLoading phase={bootstrap.status.currentPhase} />;
  }

  // Show error state if bootstrap failed
  if (bootstrap.error && !bootstrap.isReady) {
    return (
      <BootstrapError
        error={bootstrap.error}
        phase={bootstrap.status.failedPhase}
        onRetry={bootstrap.retry}
        onReset={bootstrap.reset}
      />
    );
  }

  return (
    <BootstrapContext.Provider value={bootstrap}>
      {children}
    </BootstrapContext.Provider>
  );
}

export function useBootstrapContext() {
  const context = useContext(BootstrapContext);

  if (!context) {
    throw new Error('useBootstrapContext must be used within BootstrapProvider');
  }

  return context;
}

// Loading component
function BootstrapLoading({ phase }: { phase: string | null }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-sm text-gray-500">
          {phase ? `Initializing ${phase}...` : 'Starting...'}
        </p>
      </div>
    </div>
  );
}

// Error component
function BootstrapError({
  error,
  phase,
  onRetry,
  onReset,
}: {
  error: Error;
  phase: string | null;
  onRetry: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
        <h2 className="text-lg font-semibold text-red-700">
          Initialization Failed
        </h2>
        <p className="mt-2 text-sm text-red-600">
          {error.message}
        </p>
        {phase && (
          <p className="mt-1 text-xs text-red-500">
            Failed during: {phase}
          </p>
        )}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <button
            onClick={onReset}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
          >
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

## Cross-References

| Spec | Relationship |
|------|--------------|
| [Database Schema](../database/schema.md) | Defines tables validated in schema phase |
| [Agent Service](../services/agent-service.md) | Depends on bootstrap completion |
| [Task Service](../services/task-service.md) | Depends on bootstrap completion |
| [Project Service](../services/project-service.md) | Depends on bootstrap completion |
| [Session Service](../services/session-service.md) | Depends on bootstrap completion |
| [Durable Sessions](../integrations/durable-sessions.md) | Streams phase initializes connection |
| [GitHub App](../integrations/github-app.md) | GitHub phase validates token |
| [Error Catalog](../errors/error-catalog.md) | Bootstrap error definitions |
