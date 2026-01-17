import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';
import type { BootstrapContext } from '../types.js';
import * as schema from '../../../db/schema/index.js';

export const seedDefaults = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  try {
    const existingProjects = await ctx.db.query('select id from projects limit 1');
    if (existingProjects.rows && existingProjects.rows.length > 0) {
      return ok(undefined);
    }

    const result = await ctx.db.query(
      `insert into projects (name, path, description) values ($1, $2, $3) returning id`,
      ['Default Project', process.cwd(), 'Default project created on first run']
    );

    const projectId = result.rows?.[0]?.id as string | undefined;
    if (!projectId) {
      return err(createError('BOOTSTRAP_SEED_FAILED', 'Failed to seed project', 500));
    }

    await ctx.db.query(
      `insert into agents (project_id, name, type, status, config)
       values ($1, $2, $3, $4, $5)`,
      [
        projectId,
        'Default Agent',
        'task',
        'idle',
        JSON.stringify({ allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'], maxTurns: 50 }),
      ]
    );

    return ok(undefined);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_SEED_FAILED', 'Failed to seed defaults', 500, {
        error: String(error),
      })
    );
  }
};
