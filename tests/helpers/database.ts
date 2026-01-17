import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import * as schema from '../../src/db/schema';
import type { Database } from '../../src/types/database';
import { createTestAgent } from '../factories/agent.factory';
import { createTestProject } from '../factories/project.factory';
import { createTestTask } from '../factories/task.factory';

let testPglite: PGlite | null = null;
let testDb: Database | null = null;

export async function setupTestDatabase(): Promise<Database> {
  if (testDb) {
    return testDb;
  }

  testPglite = new PGlite();
  testDb = drizzle(testPglite, { schema }) as Database;

  await migrate(testDb, { migrationsFolder: './src/db/migrations' });

  return testDb;
}

export async function clearTestDatabase(): Promise<void> {
  if (!testDb) {
    return;
  }

  await testDb.delete(schema.auditLogs);
  await testDb.delete(schema.agentRuns);
  await testDb.delete(schema.sessions);
  await testDb.delete(schema.worktrees);
  await testDb.delete(schema.tasks);
  await testDb.delete(schema.agents);
  await testDb.delete(schema.repositoryConfigs);
  await testDb.delete(schema.githubInstallations);
  await testDb.delete(schema.projects);
}

export async function closeTestDatabase(): Promise<void> {
  if (testPglite) {
    await testPglite.close();
    testPglite = null;
    testDb = null;
  }
}

export function getTestDb(): Database {
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
