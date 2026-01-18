import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

const envDataDir = typeof process !== 'undefined' ? process.env?.PGLITE_DATA_DIR : undefined;
const pgliteDataDir = envDataDir === undefined ? 'idb://agentpane' : envDataDir || undefined;
export const pglite = new PGlite(pgliteDataDir);

export const db = drizzle(pglite, { schema });

export const createServerDb = (dataDir: string = './data') => {
  const serverPglite = new PGlite(`${dataDir}/agentpane.db`);
  return drizzle(serverPglite, { schema });
};
