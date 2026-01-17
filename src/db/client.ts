import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from './schema';

const pglite = new PGlite('idb://agentpane');

export const db = drizzle(pglite, { schema });

export const createServerDb = (dataDir: string = './data') => {
  const serverPglite = new PGlite(`${dataDir}/agentpane.db`);
  return drizzle(serverPglite, { schema });
};
