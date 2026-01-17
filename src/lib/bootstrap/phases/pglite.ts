import { PGlite } from '@electric-sql/pglite';
import { createError } from '../../errors/base.js';
import { err, ok } from '../../utils/result.js';
import type { BootstrapContext } from '../types.js';

const BOOTSTRAP_ERROR_CODE = 'BOOTSTRAP_PGLITE_INIT_FAILED';

export const initializePGlite = async () => {
  if (!globalThis.indexedDB) {
    return err(createError('BOOTSTRAP_INDEXEDDB_UNAVAILABLE', 'IndexedDB not available', 500));
  }

  try {
    const testDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('__bootstrap_test__');
      request.onerror = () => reject(new Error('IndexedDB blocked'));
      request.onsuccess = () => resolve(request.result);
    });
    testDb.close();
    indexedDB.deleteDatabase('__bootstrap_test__');
  } catch (error) {
    return err(
      createError('BOOTSTRAP_PRIVATE_BROWSING', 'IndexedDB blocked in private mode', 500, {
        error: String(error),
      })
    );
  }

  const pglite = new PGlite('idb://agentpane');

  try {
    await pglite.query('SELECT 1');
    return ok(pglite);
  } catch (error) {
    return err(
      createError(BOOTSTRAP_ERROR_CODE, 'Failed to initialize PGlite', 500, {
        error: String(error),
      })
    );
  }
};

export const applyPGliteToContext = (ctx: BootstrapContext, pglite: PGlite) => {
  ctx.db = pglite;
};
