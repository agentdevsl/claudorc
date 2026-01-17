import type { ZodIssue } from 'zod';
import { createError } from './base.js';

type ValidationIssue = Pick<ZodIssue, 'path' | 'message'>;

export const ValidationErrors = {
  VALIDATION_ERROR: (errors: ValidationIssue[]) =>
    createError('VALIDATION_ERROR', 'Validation failed', 400, {
      errors: errors.map((error) => ({
        path: error.path.join('.'),
        message: error.message,
      })),
    }),
  INVALID_ID: (field: string) =>
    createError('INVALID_ID', `Invalid ID format for "${field}"`, 400, { field }),
  MISSING_REQUIRED_FIELD: (field: string) =>
    createError('MISSING_REQUIRED_FIELD', `Missing required field: ${field}`, 400, { field }),
  INVALID_ENUM_VALUE: (field: string, value: string, allowed: string[]) =>
    createError('INVALID_ENUM_VALUE', `Invalid value "${value}" for "${field}"`, 400, {
      field,
      value,
      allowedValues: allowed,
    }),
  INVALID_URL: (url: string) =>
    createError('INVALID_URL', `Invalid URL: ${url}`, 400, {
      url,
    }),
} as const;

export type ValidationError =
  | ReturnType<typeof ValidationErrors.VALIDATION_ERROR>
  | ReturnType<typeof ValidationErrors.INVALID_ID>
  | ReturnType<typeof ValidationErrors.MISSING_REQUIRED_FIELD>
  | ReturnType<typeof ValidationErrors.INVALID_ENUM_VALUE>
  | ReturnType<typeof ValidationErrors.INVALID_URL>;
