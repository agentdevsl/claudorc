import { createError } from './base.js';

export const GitHubErrors = {
  AUTH_FAILED: (error: string) =>
    createError('GITHUB_AUTH_FAILED', 'GitHub authentication failed', 401, { error }),
  INSTALLATION_NOT_FOUND: (installationId: string) =>
    createError('GITHUB_INSTALLATION_NOT_FOUND', 'GitHub App installation not found', 404, {
      installationId,
    }),
  REPO_NOT_FOUND: (owner: string, repo: string) =>
    createError('GITHUB_REPO_NOT_FOUND', `Repository "${owner}/${repo}" not found`, 404, {
      owner,
      repo,
    }),
  CONFIG_NOT_FOUND: (path: string) =>
    createError('GITHUB_CONFIG_NOT_FOUND', `Configuration not found at "${path}"`, 404, {
      path,
    }),
  CONFIG_INVALID: (errors: string[]) =>
    createError('GITHUB_CONFIG_INVALID', 'Invalid configuration format', 400, {
      validationErrors: errors,
    }),
  WEBHOOK_INVALID: createError('GITHUB_WEBHOOK_INVALID', 'Invalid webhook signature', 401),
  RATE_LIMITED: (resetAt: number) =>
    createError('GITHUB_RATE_LIMITED', 'GitHub API rate limit exceeded', 429, {
      resetAt: new Date(resetAt * 1000).toISOString(),
    }),
  PR_CREATION_FAILED: (error: string) =>
    createError('GITHUB_PR_CREATION_FAILED', 'Failed to create pull request', 500, { error }),
} as const;

export type GitHubError =
  | ReturnType<typeof GitHubErrors.AUTH_FAILED>
  | ReturnType<typeof GitHubErrors.INSTALLATION_NOT_FOUND>
  | ReturnType<typeof GitHubErrors.REPO_NOT_FOUND>
  | ReturnType<typeof GitHubErrors.CONFIG_NOT_FOUND>
  | ReturnType<typeof GitHubErrors.CONFIG_INVALID>
  | typeof GitHubErrors.WEBHOOK_INVALID
  | ReturnType<typeof GitHubErrors.RATE_LIMITED>
  | ReturnType<typeof GitHubErrors.PR_CREATION_FAILED>;
