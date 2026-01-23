import * as fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock better-sqlite3 before any imports using vi.hoisted
const betterSqlite3Mocks = vi.hoisted(() => {
  const mockExec = vi.fn();
  const mockPragma = vi.fn();
  const mockPrepare = vi.fn(() => ({ get: vi.fn() }));
  const mockClose = vi.fn();

  // Store the mock instance for access in tests
  let mockDatabaseInstance: {
    exec: typeof mockExec;
    pragma: typeof mockPragma;
    prepare: typeof mockPrepare;
    close: typeof mockClose;
  };

  // Create a proper class-like constructor function
  function MockDatabaseClass(this: unknown, _path: string) {
    mockDatabaseInstance = {
      exec: mockExec,
      pragma: mockPragma,
      prepare: mockPrepare,
      close: mockClose,
    };
    Object.assign(this as object, mockDatabaseInstance);
    return this;
  }

  // Make it look like a constructor
  const MockDatabaseFn = vi.fn(MockDatabaseClass);

  return {
    MockDatabaseFn,
    getMockInstance: () => mockDatabaseInstance,
    mockExec,
    mockPragma,
    mockPrepare,
    mockClose,
    resetMocks: () => {
      mockExec.mockReset();
      mockPragma.mockReset();
      mockPrepare.mockReset();
      mockClose.mockReset();
      MockDatabaseFn.mockReset();
      MockDatabaseFn.mockImplementation(MockDatabaseClass);
    },
  };
});

vi.mock('better-sqlite3', () => ({
  default: betterSqlite3Mocks.MockDatabaseFn,
}));

// Mock drizzle-orm
const mockDrizzle = vi.fn(() => ({ query: {} }));
vi.mock('drizzle-orm/better-sqlite3', () => ({
  drizzle: mockDrizzle,
}));

// Mock the schema module
vi.mock('@/db/schema', () => ({
  projects: { id: 'id' },
  tasks: { id: 'id' },
  agents: { id: 'id' },
}));

// Mock the migration SQL
vi.mock('@/lib/bootstrap/phases/schema', () => ({
  MIGRATION_SQL: 'CREATE TABLE IF NOT EXISTS test_table (id TEXT);',
}));

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
}));

describe('Database Client', () => {
  const { MockDatabaseFn, mockExec, mockPragma, resetMocks } = betterSqlite3Mocks;

  beforeEach(() => {
    vi.resetModules();
    resetMocks();
    mockDrizzle.mockReset();
    mockDrizzle.mockReturnValue({ query: {} });
    vi.mocked(fs.existsSync).mockReset();
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(fs.mkdirSync).mockReset();

    // Reset window/document to simulate server environment
    vi.stubGlobal('window', undefined);
    vi.stubGlobal('document', undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  describe('Database Initialization', () => {
    it('creates SQLite database in test mode with in-memory storage', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const { sqlite } = await import('@/db/client');

      expect(MockDatabaseFn).toHaveBeenCalledWith(':memory:');
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
      expect(sqlite).toBeDefined();
    });

    it('creates SQLite database with E2E seed mode in memory', async () => {
      vi.stubEnv('VITE_E2E_SEED', 'true');
      vi.stubEnv('NODE_ENV', 'development');

      await import('@/db/client');

      expect(MockDatabaseFn).toHaveBeenCalledWith(':memory:');
    });

    it('creates file-based database in production mode', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');

      await import('@/db/client');

      expect(MockDatabaseFn).toHaveBeenCalledWith('./data/agentpane.db');
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('uses custom data directory from environment variable', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');
      vi.stubEnv('SQLITE_DATA_DIR', '/custom/data/path');

      await import('@/db/client');

      expect(MockDatabaseFn).toHaveBeenCalledWith('/custom/data/path/agentpane.db');
    });

    it('creates data directory if it does not exist', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await import('@/db/client');

      expect(fs.mkdirSync).toHaveBeenCalledWith('./data', { recursive: true });
    });

    it('returns null database in browser environment', async () => {
      vi.stubGlobal('window', {});
      vi.stubGlobal('document', {});

      const { sqlite, db } = await import('@/db/client');

      expect(sqlite).toBeNull();
      expect(db).toBeNull();
      expect(MockDatabaseFn).not.toHaveBeenCalled();
    });
  });

  describe('Migration Handling', () => {
    it('executes migration SQL on database creation', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      await import('@/db/client');

      expect(mockExec).toHaveBeenCalledWith('CREATE TABLE IF NOT EXISTS test_table (id TEXT);');
    });

    it('throws error when migration fails', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const migrationError = new Error('Migration syntax error');
      mockExec.mockImplementation(() => {
        throw migrationError;
      });

      await expect(import('@/db/client')).rejects.toThrow('Migration syntax error');
    });

    it('logs migration success message', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await import('@/db/client');

      expect(consoleSpy).toHaveBeenCalledWith('[DB] Schema migration completed successfully');
      consoleSpy.mockRestore();
    });

    it('logs migration failure with error details', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const migrationError = new Error('SQL syntax error');
      mockExec.mockImplementation(() => {
        throw migrationError;
      });
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      try {
        await import('@/db/client');
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith('[DB] Schema migration failed:', migrationError);
      consoleSpy.mockRestore();
    });
  });

  describe('Connection Management', () => {
    it('enables WAL mode for file-based database', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');

      await import('@/db/client');

      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
    });

    it('enables foreign keys constraint', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      await import('@/db/client');

      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('wraps sqlite instance with drizzle ORM', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const { db } = await import('@/db/client');

      expect(mockDrizzle).toHaveBeenCalledWith(expect.any(Object), {
        schema: expect.any(Object),
      });
      expect(db).toBeDefined();
    });

    it('exports createServerDb function for custom data directories', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const { createServerDb } = await import('@/db/client');

      expect(createServerDb).toBeDefined();
      expect(typeof createServerDb).toBe('function');
    });

    it('createServerDb creates database with custom path', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      // First import to get the function
      const { createServerDb } = await import('@/db/client');

      // Reset mock counts after module initialization
      resetMocks();

      // Call createServerDb with custom directory
      createServerDb('/custom/server/path');

      expect(MockDatabaseFn).toHaveBeenCalledWith('/custom/server/path/agentpane.db');
      expect(mockPragma).toHaveBeenCalledWith('journal_mode = WAL');
      expect(mockPragma).toHaveBeenCalledWith('foreign_keys = ON');
    });

    it('createServerDb uses default path when not specified', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const { createServerDb } = await import('@/db/client');
      resetMocks();

      createServerDb();

      expect(MockDatabaseFn).toHaveBeenCalledWith('./data/agentpane.db');
    });

    it('exports pglite alias for backwards compatibility', async () => {
      vi.stubEnv('NODE_ENV', 'test');

      const { pglite, sqlite } = await import('@/db/client');

      expect(pglite).toBe(sqlite);
    });
  });

  describe('Error Handling', () => {
    it('handles database creation failure', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');
      const dbError = new Error('Failed to open database');

      MockDatabaseFn.mockImplementation(function (this: unknown) {
        throw dbError;
      });

      await expect(import('@/db/client')).rejects.toThrow('Failed to open database');
    });

    it('handles missing data directory with creation failure', async () => {
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('VITE_E2E_SEED', 'false');
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(import('@/db/client')).rejects.toThrow('Permission denied');
    });

    it('handles pragma execution failure', async () => {
      vi.stubEnv('NODE_ENV', 'test');
      const pragmaError = new Error('Pragma failed');
      mockPragma.mockImplementation(() => {
        throw pragmaError;
      });

      await expect(import('@/db/client')).rejects.toThrow('Pragma failed');
    });
  });
});
