import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';
import { createServerDb } from '../../../db/client.js';
import type { BootstrapContext } from '../types.js';

export const validateSchema = async (ctx: BootstrapContext) => {
  if (!ctx.db) {
    return err(createError('BOOTSTRAP_NO_DATABASE', 'Database not initialized', 500));
  }

  try {
    // Placeholder migrator until drizzle-kit migrate is wired in runtime.
    // Using createServerDb to ensure schema module is loaded.
    createServerDb();
    return ok(undefined);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_SCHEMA_VALIDATION_FAILED', 'Schema validation failed', 500, {
        error: String(error),
      })
    );
  }
};
