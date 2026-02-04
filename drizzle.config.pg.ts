import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/postgres/index.ts',
  out: './src/db/migrations-pg',
  dialect: 'postgresql',
  dbCredentials: {
    url:
      process.env.DATABASE_URL ?? 'postgresql://agentpane:agentpane_dev@localhost:5432/agentpane',
  },
} satisfies Config;
