import { Octokit } from 'octokit';

export interface GitHubClientOptions {
  token?: string;
  installationId?: number;
}

let appOctokit: Octokit | null = null;

export function getAppOctokit(): Octokit {
  if (!appOctokit) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_PRIVATE_KEY;

    if (!appId || !privateKey) {
      throw new Error('GitHub App credentials not configured (GITHUB_APP_ID, GITHUB_PRIVATE_KEY)');
    }

    appOctokit = new Octokit({
      auth: {
        appId,
        privateKey,
      },
    });
  }

  return appOctokit;
}

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const app = getAppOctokit();

  // Get installation access token
  const { data: installation } = await app.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  return new Octokit({
    auth: installation.token,
  });
}

export function createOctokitFromToken(token: string): Octokit {
  return new Octokit({
    auth: token,
  });
}

export type { Octokit };
