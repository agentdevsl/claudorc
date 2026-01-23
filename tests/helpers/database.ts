import Database, { type Database as SQLiteDatabase } from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../src/db/schema';
import { MIGRATION_SQL } from '../../src/lib/bootstrap/phases/schema';
import { createTestAgent } from '../factories/agent.factory';
import { createTestProject } from '../factories/project.factory';
import { createTestTask } from '../factories/task.factory';

// Use BetterSQLite3Database as the database type for tests
type TestDatabase = BetterSQLite3Database<typeof schema>;

let testSqlite: SQLiteDatabase | null = null;
let testDb: TestDatabase | null = null;

export async function setupTestDatabase(): Promise<TestDatabase> {
  if (testDb) {
    return testDb;
  }

  // Use in-memory SQLite for tests
  testSqlite = new Database(':memory:');
  testSqlite.pragma('foreign_keys = ON');

  testDb = drizzle(testSqlite, { schema });

  // Run migrations using inline SQL
  testSqlite.exec(MIGRATION_SQL);

  return testDb;
}

/**
 * Execute raw SQL on the test database
 * Useful for creating additional tables or running custom migrations
 */
export function execRawSql(sql: string): void {
  if (!testSqlite) {
    throw new Error('Test database not initialized');
  }
  testSqlite.exec(sql);
}

export async function clearTestDatabase(): Promise<void> {
  if (!testDb) {
    return;
  }

  // Delete in order respecting foreign key constraints
  await testDb.delete(schema.auditLogs);
  await testDb.delete(schema.agentRuns);
  await testDb.delete(schema.sessions);
  await testDb.delete(schema.worktrees);
  await testDb.delete(schema.tasks);
  await testDb.delete(schema.agents);
  await testDb.delete(schema.repositoryConfigs);
  await testDb.delete(schema.githubInstallations);
  await testDb.delete(schema.githubTokens);
  await testDb.delete(schema.projects);
  await testDb.delete(schema.sandboxConfigs);
  await testDb.delete(schema.marketplaces);
}

export async function closeTestDatabase(): Promise<void> {
  if (testSqlite) {
    testSqlite.close();
    testSqlite = null;
    testDb = null;
  }
}

export function getTestDb(): TestDatabase {
  if (!testDb) {
    throw new Error('Test database not initialized');
  }
  return testDb;
}

export type SeedOptions = {
  projects?: number;
  tasksPerProject?: number;
  agentsPerProject?: number;
};

export async function seedTestDatabase(options: SeedOptions = {}): Promise<schema.Project[]> {
  const { projects = 1, tasksPerProject = 5, agentsPerProject = 2 } = options;

  const createdProjects: schema.Project[] = [];

  for (let projectIndex = 0; projectIndex < projects; projectIndex += 1) {
    const project = await createTestProject({
      name: `Test Project ${projectIndex + 1}`,
    });
    createdProjects.push(project);

    for (let agentIndex = 0; agentIndex < agentsPerProject; agentIndex += 1) {
      await createTestAgent(project.id, { name: `Agent ${agentIndex + 1}` });
    }

    for (let taskIndex = 0; taskIndex < tasksPerProject; taskIndex += 1) {
      await createTestTask(project.id, { title: `Task ${taskIndex + 1}` });
    }
  }

  return createdProjects;
}
