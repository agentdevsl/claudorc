import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

interface Collection {
  insertMany: (items: unknown[]) => void;
}

interface CollectionMap {
  projects: Collection;
  tasks: Collection;
  agents: Collection;
  sessions: Collection;
}

const createCollection = (): Collection => ({
  insertMany: (_items: unknown[]) => undefined,
});

export const initializeCollections = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  const collections: CollectionMap = {
    projects: createCollection(),
    tasks: createCollection(),
    agents: createCollection(),
    sessions: createCollection(),
  };

  try {
    // Use better-sqlite3 API (synchronous)
    const projects = ctx.db.prepare('SELECT * FROM projects').all();
    const tasks = ctx.db.prepare('SELECT * FROM tasks').all();
    const agents = ctx.db.prepare('SELECT * FROM agents').all();
    const sessions = ctx.db.prepare('SELECT * FROM sessions').all();

    collections.projects.insertMany(projects);
    collections.tasks.insertMany(tasks);
    collections.agents.insertMany(agents);
    collections.sessions.insertMany(sessions);

    ctx.collections = collections as unknown as Record<string, unknown>;

    return ok(collections);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_COLLECTIONS_FAILED', 'Failed to initialize collections', 500, {
        error: String(error),
      })
    );
  }
};
