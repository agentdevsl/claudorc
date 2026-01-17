import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';
import * as schema from '../../../db/schema/index.js';
import type { BootstrapContext } from '../types.js';

type CollectionMap = Record<string, { insertMany: (items: unknown[]) => void }>;

const createCollection = () => ({
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
    const [projects, tasks, agents, sessions] = await Promise.all([
      ctx.db.query('select * from projects'),
      ctx.db.query('select * from tasks'),
      ctx.db.query('select * from agents'),
      ctx.db.query('select * from sessions'),
    ]);

    collections.projects.insertMany(projects.rows ?? []);
    collections.tasks.insertMany(tasks.rows ?? []);
    collections.agents.insertMany(agents.rows ?? []);
    collections.sessions.insertMany(sessions.rows ?? []);

    ctx.collections = collections;

    return ok(collections);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_COLLECTIONS_FAILED', 'Failed to initialize collections', 500, {
        error: String(error),
      })
    );
  }
};
