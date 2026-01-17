import { createError } from './base.js';

export const ProjectErrors = {
  NOT_FOUND: createError('PROJECT_NOT_FOUND', 'Project not found', 404),
  PATH_EXISTS: createError('PROJECT_PATH_EXISTS', 'A project with this path already exists', 409),
  PATH_INVALID: (path: string) =>
    createError('PROJECT_PATH_INVALID', `Invalid project path: ${path}`, 400, {
      path,
    }),
  HAS_RUNNING_AGENTS: (count: number) =>
    createError(
      'PROJECT_HAS_RUNNING_AGENTS',
      `Cannot delete project with ${count} running agent(s)`,
      409,
      { runningAgentCount: count }
    ),
  CONFIG_INVALID: (errors: string[]) =>
    createError('PROJECT_CONFIG_INVALID', 'Invalid project configuration', 400, {
      validationErrors: errors,
    }),
} as const;

export type ProjectError =
  | typeof ProjectErrors.NOT_FOUND
  | typeof ProjectErrors.PATH_EXISTS
  | ReturnType<typeof ProjectErrors.PATH_INVALID>
  | ReturnType<typeof ProjectErrors.HAS_RUNNING_AGENTS>
  | ReturnType<typeof ProjectErrors.CONFIG_INVALID>;
