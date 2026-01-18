import { githubTokens } from '../db/schema/github.js';
import {
  decryptToken,
  encryptToken,
  isValidPATFormat,
  maskToken,
} from '../lib/crypto/token-encryption.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export type GitHubTokenError =
  | { code: 'INVALID_FORMAT'; message: string }
  | { code: 'VALIDATION_FAILED'; message: string }
  | { code: 'NOT_FOUND'; message: string }
  | { code: 'STORAGE_ERROR'; message: string };

export type ValidatedUser = {
  login: string;
  id: number;
  avatarUrl: string;
  name: string | null;
};

export type TokenInfo = {
  id: string;
  maskedToken: string;
  githubLogin: string | null;
  isValid: boolean;
  lastValidatedAt: string | null;
  createdAt: string;
};

export class GitHubTokenService {
  constructor(private db: Database) {}

  /**
   * Save a new GitHub PAT (encrypted)
   * Validates the token with GitHub API before saving
   */
  async saveToken(token: string): Promise<Result<TokenInfo, GitHubTokenError>> {
    // Validate format
    if (!isValidPATFormat(token)) {
      return err({
        code: 'INVALID_FORMAT',
        message: 'Invalid token format. GitHub PATs start with "ghp_" or "github_pat_"',
      });
    }

    // Validate with GitHub API
    const validation = await this.validateWithGitHub(token);
    if (!validation.ok) {
      return validation;
    }

    try {
      // Delete any existing token (we only keep one)
      await this.db.delete(githubTokens);

      // Encrypt and store
      const encrypted = await encryptToken(token);

      const [saved] = await this.db
        .insert(githubTokens)
        .values({
          encryptedToken: encrypted,
          tokenType: 'pat',
          githubLogin: validation.value.login,
          githubId: String(validation.value.id),
          isValid: true,
          lastValidatedAt: new Date().toISOString(),
        })
        .returning();

      if (!saved) {
        return err({
          code: 'STORAGE_ERROR',
          message: 'Failed to save token',
        });
      }

      return ok({
        id: saved.id,
        maskedToken: maskToken(token),
        githubLogin: saved.githubLogin,
        isValid: saved.isValid ?? true,
        lastValidatedAt: saved.lastValidatedAt,
        createdAt: saved.createdAt,
      });
    } catch (error) {
      return err({
        code: 'STORAGE_ERROR',
        message: `Failed to save token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Get the current saved token info (without the actual token)
   */
  async getTokenInfo(): Promise<Result<TokenInfo | null, GitHubTokenError>> {
    try {
      const token = await this.db.query.githubTokens.findFirst();

      if (!token) {
        return ok(null);
      }

      // Decrypt to get masked version
      const decrypted = await decryptToken(token.encryptedToken);

      return ok({
        id: token.id,
        maskedToken: maskToken(decrypted),
        githubLogin: token.githubLogin,
        isValid: token.isValid ?? true,
        lastValidatedAt: token.lastValidatedAt,
        createdAt: token.createdAt,
      });
    } catch (error) {
      return err({
        code: 'STORAGE_ERROR',
        message: `Failed to get token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Get the decrypted token for API use
   * Returns null if no token is saved
   */
  async getDecryptedToken(): Promise<string | null> {
    try {
      const token = await this.db.query.githubTokens.findFirst();

      if (!token) {
        return null;
      }

      return await decryptToken(token.encryptedToken);
    } catch {
      return null;
    }
  }

  /**
   * Delete the saved token
   */
  async deleteToken(): Promise<Result<void, GitHubTokenError>> {
    try {
      await this.db.delete(githubTokens);
      return ok(undefined);
    } catch (error) {
      return err({
        code: 'STORAGE_ERROR',
        message: `Failed to delete token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Re-validate the saved token
   */
  async revalidateToken(): Promise<Result<boolean, GitHubTokenError>> {
    const token = await this.getDecryptedToken();

    if (!token) {
      return err({
        code: 'NOT_FOUND',
        message: 'No token saved',
      });
    }

    const validation = await this.validateWithGitHub(token);

    // Update validation status
    const isValid = validation.ok;
    await this.db.update(githubTokens).set({
      isValid,
      lastValidatedAt: new Date().toISOString(),
      githubLogin: validation.ok ? validation.value.login : undefined,
      updatedAt: new Date().toISOString(),
    });

    return ok(isValid);
  }

  /**
   * Validate a token with GitHub API
   */
  private async validateWithGitHub(
    token: string
  ): Promise<Result<ValidatedUser, GitHubTokenError>> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return err({
            code: 'VALIDATION_FAILED',
            message: 'Invalid token. Please check your token and try again.',
          });
        }
        return err({
          code: 'VALIDATION_FAILED',
          message: `GitHub API error: ${response.status} ${response.statusText}`,
        });
      }

      const user = await response.json();

      return ok({
        login: user.login,
        id: user.id,
        avatarUrl: user.avatar_url,
        name: user.name,
      });
    } catch (error) {
      return err({
        code: 'VALIDATION_FAILED',
        message: `Failed to validate token: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Make an authenticated GitHub API request
   */
  async fetchGitHub<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Result<T, GitHubTokenError>> {
    const token = await this.getDecryptedToken();

    if (!token) {
      return err({
        code: 'NOT_FOUND',
        message: 'No GitHub token configured',
      });
    }

    try {
      const response = await fetch(`https://api.github.com${endpoint}`, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          ...options.headers,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Mark token as invalid
          await this.db
            .update(githubTokens)
            .set({ isValid: false, updatedAt: new Date().toISOString() });

          return err({
            code: 'VALIDATION_FAILED',
            message: 'Token is no longer valid',
          });
        }
        return err({
          code: 'VALIDATION_FAILED',
          message: `GitHub API error: ${response.status} ${response.statusText}`,
        });
      }

      const data = await response.json();
      return ok(data as T);
    } catch (error) {
      return err({
        code: 'VALIDATION_FAILED',
        message: `GitHub API request failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Get repository info
   */
  async getRepository(owner: string, repo: string): Promise<Result<GitHubRepo, GitHubTokenError>> {
    return this.fetchGitHub<GitHubRepo>(`/repos/${owner}/${repo}`);
  }

  /**
   * List repository branches
   */
  async listBranches(
    owner: string,
    repo: string
  ): Promise<Result<GitHubBranch[], GitHubTokenError>> {
    return this.fetchGitHub<GitHubBranch[]>(`/repos/${owner}/${repo}/branches`);
  }
}

// GitHub API types
export type GitHubRepo = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  owner: {
    login: string;
    avatar_url: string;
  };
  default_branch: string;
  description: string | null;
};

export type GitHubBranch = {
  name: string;
  protected: boolean;
};
