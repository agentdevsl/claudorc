import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/sqlite/index.ts',
  out: './src/db/migrations',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.SQLITE_DATA_DIR
      ? `${process.env.SQLITE_DATA_DIR}/agentpane.db`
      : './data/agentpane.db',
  },
} satisfies Config;
