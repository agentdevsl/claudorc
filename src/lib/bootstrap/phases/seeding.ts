import { createId } from '@paralleldrive/cuid2';
import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

export const seedDefaults = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  try {
    // Use better-sqlite3 API (synchronous)
    const existingProjects = ctx.db.prepare('SELECT id FROM projects LIMIT 1').all();
    if (existingProjects.length > 0) {
      return ok(undefined);
    }

    const projectId = createId();
    const now = new Date().toISOString();

    ctx.db
      .prepare(`
      INSERT INTO projects (id, name, path, description, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      .run(
        projectId,
        'Default Project',
        process.cwd(),
        'Default project created on first run',
        now,
        now
      );

    const agentId = createId();
    const agentConfig = JSON.stringify({
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      maxTurns: 50,
    });

    ctx.db
      .prepare(`
      INSERT INTO agents (id, project_id, name, type, status, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
      .run(agentId, projectId, 'Default Agent', 'task', 'idle', agentConfig, now, now);

    return ok(undefined);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_SEED_FAILED', 'Failed to seed defaults', 500, {
        error: String(error),
      })
    );
  }
};
