import { createError } from './base.js';

export const TerraformErrors = {
  REGISTRY_NOT_FOUND: createError(
    'TERRAFORM_REGISTRY_NOT_FOUND',
    'Terraform registry not found',
    404
  ),
  MODULE_NOT_FOUND: createError('TERRAFORM_MODULE_NOT_FOUND', 'Terraform module not found', 404),
  REGISTRY_ALREADY_EXISTS: createError(
    'TERRAFORM_REGISTRY_ALREADY_EXISTS',
    'A Terraform registry with this organization already exists',
    409
  ),
  INVALID_TOKEN: createError(
    'TERRAFORM_INVALID_TOKEN',
    'Invalid or missing Terraform API token',
    401
  ),
  NO_MODULES_SYNCED: createError(
    'TERRAFORM_NO_MODULES_SYNCED',
    'No modules found in the registry',
    404
  ),
  SYNC_FAILED: (reason: string) =>
    createError('TERRAFORM_SYNC_FAILED', `Failed to sync Terraform registry: ${reason}`, 500, {
      reason,
    }),
  COMPOSE_FAILED: (reason: string) =>
    createError(
      'TERRAFORM_COMPOSE_FAILED',
      `Failed to compose Terraform configuration: ${reason}`,
      500,
      {
        reason,
      }
    ),
} as const;

export type TerraformError =
  | typeof TerraformErrors.REGISTRY_NOT_FOUND
  | typeof TerraformErrors.MODULE_NOT_FOUND
  | typeof TerraformErrors.REGISTRY_ALREADY_EXISTS
  | typeof TerraformErrors.INVALID_TOKEN
  | typeof TerraformErrors.NO_MODULES_SYNCED
  | ReturnType<typeof TerraformErrors.SYNC_FAILED>
  | ReturnType<typeof TerraformErrors.COMPOSE_FAILED>;
