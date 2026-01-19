import { createError } from './base.js';

export const TemplateErrors = {
  NOT_FOUND: createError('TEMPLATE_NOT_FOUND', 'Template not found', 404),
  ALREADY_EXISTS: createError(
    'TEMPLATE_ALREADY_EXISTS',
    'A template with this repository already exists',
    409
  ),
  INVALID_REPO_URL: (url: string) =>
    createError('TEMPLATE_INVALID_REPO_URL', `Invalid GitHub repository URL: ${url}`, 400, {
      url,
    }),
  SYNC_FAILED: (reason: string) =>
    createError('TEMPLATE_SYNC_FAILED', `Failed to sync template: ${reason}`, 500, { reason }),
  FETCH_FAILED: (path: string, reason: string) =>
    createError('TEMPLATE_FETCH_FAILED', `Failed to fetch ${path}: ${reason}`, 500, {
      path,
      reason,
    }),
  PARSE_FAILED: (path: string, reason: string) =>
    createError('TEMPLATE_PARSE_FAILED', `Failed to parse ${path}: ${reason}`, 400, {
      path,
      reason,
    }),
  PROJECT_REQUIRED: createError(
    'TEMPLATE_PROJECT_REQUIRED',
    'Project ID is required for project-scoped templates',
    400
  ),
  INVALID_SCOPE: (scope: string) =>
    createError('TEMPLATE_INVALID_SCOPE', `Invalid template scope: ${scope}`, 400, { scope }),
} as const;

export type TemplateError =
  | typeof TemplateErrors.NOT_FOUND
  | typeof TemplateErrors.ALREADY_EXISTS
  | typeof TemplateErrors.PROJECT_REQUIRED
  | ReturnType<typeof TemplateErrors.INVALID_REPO_URL>
  | ReturnType<typeof TemplateErrors.SYNC_FAILED>
  | ReturnType<typeof TemplateErrors.FETCH_FAILED>
  | ReturnType<typeof TemplateErrors.PARSE_FAILED>
  | ReturnType<typeof TemplateErrors.INVALID_SCOPE>;
