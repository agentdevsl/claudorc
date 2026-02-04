import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as pgSchema from '../../../db/schema/postgres/index.js';
import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

export const initializePostgres = async (_ctx: BootstrapContext) => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return err(
      createError('BOOTSTRAP_PG_INIT_FAILED', 'DATABASE_URL is required when DB_MODE=postgres', 500)
    );
  }

  try {
    const client = postgres(connectionString);
    const db = drizzle(client, { schema: pgSchema });

    // Verify connection
    await client`SELECT 1 as test`;

    // Run migrations
    await migrate(db, { migrationsFolder: './src/db/migrations-pg' });

    return ok(db);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_PG_INIT_FAILED', 'PostgreSQL initialization failed', 500, {
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
};
