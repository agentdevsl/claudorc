import { createError } from './base.js';

export const MarketplaceErrors = {
  NOT_FOUND: createError('MARKETPLACE_NOT_FOUND', 'Marketplace not found', 404),
  ALREADY_EXISTS: createError(
    'MARKETPLACE_ALREADY_EXISTS',
    'A marketplace with this repository already exists',
    409
  ),
  INVALID_URL: (url: string) =>
    createError('MARKETPLACE_INVALID_URL', `Invalid GitHub URL: ${url}`, 400, { url }),
  MISSING_REPO_INFO: createError(
    'MARKETPLACE_MISSING_REPO_INFO',
    'GitHub owner and repo are required',
    400
  ),
  CANNOT_DELETE_DEFAULT: createError(
    'MARKETPLACE_CANNOT_DELETE_DEFAULT',
    'Cannot delete the default marketplace',
    403
  ),
  CANNOT_DISABLE_DEFAULT: createError(
    'MARKETPLACE_CANNOT_DISABLE_DEFAULT',
    'Cannot disable the default marketplace',
    403
  ),
  SYNC_FAILED: (reason: string) =>
    createError('MARKETPLACE_SYNC_FAILED', `Failed to sync marketplace: ${reason}`, 500, {
      reason,
    }),
} as const;

export type MarketplaceError =
  | typeof MarketplaceErrors.NOT_FOUND
  | typeof MarketplaceErrors.ALREADY_EXISTS
  | ReturnType<typeof MarketplaceErrors.INVALID_URL>
  | typeof MarketplaceErrors.MISSING_REPO_INFO
  | typeof MarketplaceErrors.CANNOT_DELETE_DEFAULT
  | typeof MarketplaceErrors.CANNOT_DISABLE_DEFAULT
  | ReturnType<typeof MarketplaceErrors.SYNC_FAILED>;
