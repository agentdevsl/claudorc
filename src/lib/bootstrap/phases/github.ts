import { err, ok } from '../../utils/result.js';
import { createError } from '../../errors/base.js';
import type { BootstrapContext } from '../types.js';

export const validateGitHub = async (ctx: BootstrapContext) => {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return ok(undefined);
  }

  try {
    const { Octokit } = await import('octokit');
    const octokit = new Octokit({ auth: token });
    await octokit.users.getAuthenticated();
    ctx.githubToken = token;
    return ok(undefined);
  } catch (error) {
    return err(
      createError('BOOTSTRAP_GITHUB_FAILED', 'GitHub authentication failed', 500, {
        error: String(error),
      })
    );
  }
};
