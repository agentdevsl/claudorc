import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTestDatabase, execRawSql, getTestDb, setupTestDatabase } from '../helpers/database';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock encryption module - must be before service imports
vi.mock('../../src/lib/crypto/server-encryption', () => ({
  encryptToken: vi.fn((token: string) => `encrypted:${token}`),
  decryptToken: vi.fn((encrypted: string) => encrypted.replace('encrypted:', '')),
  maskToken: vi.fn((token: string) => `${token.slice(0, 4)}........${token.slice(-4)}`),
  isValidPATFormat: vi.fn(
    (token: string) => token.startsWith('ghp_') || token.startsWith('github_pat_')
  ),
}));

// Create mockable Octokit instance
const mockGetAuthenticated = vi.fn();
const mockReposGet = vi.fn();
const mockListBranches = vi.fn();
const mockListForAuthenticatedUser = vi.fn();
const mockListForOrg = vi.fn();
const mockOrgsListForAuthenticatedUser = vi.fn();

vi.mock('octokit', () => {
  class MockOctokit {
    rest = {
      users: {
        getAuthenticated: mockGetAuthenticated,
      },
      repos: {
        get: mockReposGet,
        listBranches: mockListBranches,
        listForAuthenticatedUser: mockListForAuthenticatedUser,
        listForOrg: mockListForOrg,
      },
      orgs: {
        listForAuthenticatedUser: mockOrgsListForAuthenticatedUser,
      },
    };
  }
  return { Octokit: MockOctokit };
});

// Import service after mocks
import { GitHubTokenService } from '../../src/services/github-token.service';

// ============================================================================
// Test Helpers
// ============================================================================

function setupDefaultMocks() {
  mockGetAuthenticated.mockResolvedValue({
    data: {
      login: 'testuser',
      id: 12345,
      avatar_url: 'https://github.com/avatar.png',
      name: 'Test User',
    },
  });

  mockReposGet.mockResolvedValue({
    data: {
      id: 1,
      name: 'test-repo',
      full_name: 'testuser/test-repo',
      private: false,
      owner: { login: 'testuser', avatar_url: 'https://github.com/avatar.png' },
      default_branch: 'main',
      description: 'Test repository',
      clone_url: 'https://github.com/testuser/test-repo.git',
      updated_at: '2025-01-01T00:00:00Z',
      stargazers_count: 42,
      is_template: false,
    },
  });

  mockListBranches.mockResolvedValue({
    data: [
      { name: 'main', protected: true },
      { name: 'develop', protected: false },
      { name: 'feature/test', protected: false },
    ],
  });

  mockListForAuthenticatedUser.mockResolvedValue({
    data: [
      {
        id: 1,
        name: 'repo-1',
        full_name: 'testuser/repo-1',
        private: false,
        owner: { login: 'testuser', avatar_url: 'https://github.com/avatar.png' },
        default_branch: 'main',
        description: 'First repo',
        clone_url: 'https://github.com/testuser/repo-1.git',
        updated_at: '2025-01-01T00:00:00Z',
        stargazers_count: 10,
        is_template: false,
      },
      {
        id: 2,
        name: 'repo-2',
        full_name: 'testuser/repo-2',
        private: true,
        owner: { login: 'testuser', avatar_url: 'https://github.com/avatar.png' },
        default_branch: 'develop',
        description: null,
        clone_url: 'https://github.com/testuser/repo-2.git',
        updated_at: '2025-01-02T00:00:00Z',
        stargazers_count: 0,
        is_template: true,
      },
    ],
  });

  mockListForOrg.mockResolvedValue({
    data: [
      {
        id: 100,
        name: 'org-repo',
        full_name: 'test-org/org-repo',
        private: false,
        owner: { login: 'test-org', avatar_url: 'https://github.com/org-avatar.png' },
        default_branch: 'main',
        description: 'Organization repo',
        clone_url: 'https://github.com/test-org/org-repo.git',
        updated_at: '2025-01-05T00:00:00Z',
        stargazers_count: 100,
        is_template: false,
      },
    ],
  });

  mockOrgsListForAuthenticatedUser.mockResolvedValue({
    data: [
      { login: 'test-org', avatar_url: 'https://github.com/org-avatar.png' },
      { login: 'another-org', avatar_url: 'https://github.com/another-org.png' },
    ],
  });
}

async function saveTestToken(tokenService: GitHubTokenService): Promise<void> {
  const result = await tokenService.saveToken('ghp_validtesttoken123456789');
  if (!result.ok) {
    throw new Error(`Failed to save test token: ${result.error.message}`);
  }
}

// ============================================================================
// Tests
// ============================================================================

describe('GitHubTokenService', () => {
  let tokenService: GitHubTokenService;

  beforeEach(async () => {
    await setupTestDatabase();
    execRawSql('DELETE FROM github_tokens');
    const db = getTestDb();
    tokenService = new GitHubTokenService(db);
    setupDefaultMocks();
  });

  afterEach(async () => {
    try {
      execRawSql('DELETE FROM github_tokens');
    } catch {
      // Ignore if table doesn't exist
    }
    await clearTestDatabase();
    vi.clearAllMocks();
  });

  // =============================================================================
  // Token Management - Save Token
  // =============================================================================

  describe('saveToken', () => {
    it('saves a valid ghp_ format token', async () => {
      const result = await tokenService.saveToken('ghp_testtoken1234567890abcdef');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.githubLogin).toBe('testuser');
        expect(result.value.isValid).toBe(true);
        expect(result.value.maskedToken).toContain('ghp_');
      }
    });

    it('saves a valid github_pat_ format token', async () => {
      const result = await tokenService.saveToken('github_pat_testtoken1234567890');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.isValid).toBe(true);
      }
    });

    it('rejects invalid token format', async () => {
      const result = await tokenService.saveToken('invalid-token-format');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_FORMAT');
        expect(result.error.message).toContain('ghp_');
      }
    });

    it('replaces existing token when saving a new one', async () => {
      // Save first token
      const firstResult = await tokenService.saveToken('ghp_firsttoken123456789abc');
      expect(firstResult.ok).toBe(true);

      // Save second token (should replace)
      const secondResult = await tokenService.saveToken('ghp_secondtoken987654321');
      expect(secondResult.ok).toBe(true);

      // Only one token should exist
      const info = await tokenService.getTokenInfo();
      expect(info.ok).toBe(true);
      if (info.ok && info.value) {
        // The masked token should be from the second token
        expect(info.value.maskedToken).toContain('ghp_');
      }
    });

    it('rejects token when GitHub API validation fails with 401', async () => {
      const error = new Error('Bad credentials') as Error & { status: number };
      error.status = 401;
      mockGetAuthenticated.mockRejectedValueOnce(error);

      const result = await tokenService.saveToken('ghp_badcredentials12345678');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Invalid token');
      }
    });

    it('handles generic GitHub API validation failure', async () => {
      mockGetAuthenticated.mockRejectedValueOnce(new Error('Network error'));

      const result = await tokenService.saveToken('ghp_networkerror1234567890');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Network error');
      }
    });
  });

  // =============================================================================
  // Token Management - Get Token Info
  // =============================================================================

  describe('getTokenInfo', () => {
    it('returns token info for saved token', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.getTokenInfo();

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.githubLogin).toBe('testuser');
        expect(result.value.maskedToken).toBeDefined();
        expect(result.value.isValid).toBe(true);
        expect(result.value.lastValidatedAt).toBeDefined();
      }
    });

    it('returns null when no token is saved', async () => {
      const result = await tokenService.getTokenInfo();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  // =============================================================================
  // Token Management - Get Decrypted Token
  // =============================================================================

  describe('getDecryptedToken', () => {
    it('returns decrypted token when saved', async () => {
      await saveTestToken(tokenService);

      const token = await tokenService.getDecryptedToken();

      expect(token).toBe('ghp_validtesttoken123456789');
    });

    it('returns null when no token is saved', async () => {
      const token = await tokenService.getDecryptedToken();

      expect(token).toBeNull();
    });
  });

  // =============================================================================
  // Token Management - Delete Token
  // =============================================================================

  describe('deleteToken', () => {
    it('deletes the saved token', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.deleteToken();

      expect(result.ok).toBe(true);

      const info = await tokenService.getTokenInfo();
      expect(info.ok).toBe(true);
      if (info.ok) {
        expect(info.value).toBeNull();
      }
    });

    it('succeeds even when no token exists', async () => {
      const result = await tokenService.deleteToken();

      expect(result.ok).toBe(true);
    });
  });

  // =============================================================================
  // Token Management - Revalidate Token
  // =============================================================================

  describe('revalidateToken', () => {
    it('revalidates an existing valid token', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.revalidateToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('returns error when no token is saved', async () => {
      const result = await tokenService.revalidateToken();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('No token saved');
      }
    });

    it('marks token as invalid when GitHub API returns 401', async () => {
      await saveTestToken(tokenService);

      // Now mock 401 for revalidation
      const error = new Error('Bad credentials') as Error & { status: number };
      error.status = 401;
      mockGetAuthenticated.mockRejectedValueOnce(error);

      const result = await tokenService.revalidateToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }
    });
  });

  // =============================================================================
  // Octokit Instance
  // =============================================================================

  describe('getOctokit', () => {
    it('returns Octokit instance when token exists', async () => {
      await saveTestToken(tokenService);

      const octokit = await tokenService.getOctokit();

      expect(octokit).not.toBeNull();
    });

    it('returns null when no token exists', async () => {
      const octokit = await tokenService.getOctokit();

      expect(octokit).toBeNull();
    });
  });

  // =============================================================================
  // GitHub API - Get Repository
  // =============================================================================

  describe('getRepository', () => {
    it('returns repository info for valid owner/repo', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.getRepository('testuser', 'test-repo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('test-repo');
        expect(result.value.full_name).toBe('testuser/test-repo');
        expect(result.value.owner.login).toBe('testuser');
        expect(result.value.default_branch).toBe('main');
        expect(result.value.description).toBe('Test repository');
        expect(result.value.stargazers_count).toBe(42);
      }
    });

    it('returns error when no token is configured', async () => {
      const result = await tokenService.getRepository('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toContain('No GitHub token configured');
      }
    });

    it('handles 401 error and marks token invalid', async () => {
      await saveTestToken(tokenService);

      const error = new Error('Bad credentials') as Error & { status: number };
      error.status = 401;
      mockReposGet.mockRejectedValueOnce(error);

      const result = await tokenService.getRepository('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('no longer valid');
      }
    });

    it('handles non-401 API errors', async () => {
      await saveTestToken(tokenService);

      const error = new Error('Not Found') as Error & { status: number };
      error.status = 404;
      mockReposGet.mockRejectedValueOnce(error);

      const result = await tokenService.getRepository('testuser', 'nonexistent');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('404');
      }
    });

    it('handles generic API errors', async () => {
      await saveTestToken(tokenService);

      mockReposGet.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await tokenService.getRepository('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Connection refused');
      }
    });
  });

  // =============================================================================
  // GitHub API - List Branches
  // =============================================================================

  describe('listBranches', () => {
    it('returns branches for a repository', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.listBranches('testuser', 'test-repo');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0].name).toBe('main');
        expect(result.value[0].protected).toBe(true);
        expect(result.value[1].name).toBe('develop');
        expect(result.value[1].protected).toBe(false);
      }
    });

    it('returns error when no token is configured', async () => {
      const result = await tokenService.listBranches('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('handles API errors', async () => {
      await saveTestToken(tokenService);

      const error = new Error('Rate limit exceeded') as Error & { status: number };
      error.status = 403;
      mockListBranches.mockRejectedValueOnce(error);

      const result = await tokenService.listBranches('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('403');
      }
    });
  });

  // =============================================================================
  // GitHub API - List User Repos
  // =============================================================================

  describe('listUserRepos', () => {
    it('returns list of user repositories sorted by update time', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.listUserRepos();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
        expect(result.value[0].name).toBe('repo-1');
        expect(result.value[0].private).toBe(false);
        expect(result.value[1].name).toBe('repo-2');
        expect(result.value[1].private).toBe(true);
        expect(result.value[1].is_template).toBe(true);
      }
    });

    it('returns error when no token is configured', async () => {
      const result = await tokenService.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('handles API errors', async () => {
      await saveTestToken(tokenService);

      mockListForAuthenticatedUser.mockRejectedValueOnce(new Error('Server error'));

      const result = await tokenService.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  // =============================================================================
  // GitHub API - List User Orgs
  // =============================================================================

  describe('listUserOrgs', () => {
    it('returns user account and organizations', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.listUserOrgs();

      expect(result.ok).toBe(true);
      if (result.ok) {
        // First entry should be the user account
        expect(result.value[0].login).toBe('testuser');
        expect(result.value[0].type).toBe('user');

        // Following entries should be organizations
        expect(result.value[1].login).toBe('test-org');
        expect(result.value[1].type).toBe('org');
        expect(result.value[2].login).toBe('another-org');
        expect(result.value[2].type).toBe('org');
      }
    });

    it('returns error when no token is configured', async () => {
      const result = await tokenService.listUserOrgs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('handles API errors when fetching orgs', async () => {
      await saveTestToken(tokenService);

      // Mock the orgs call to fail
      mockOrgsListForAuthenticatedUser.mockRejectedValueOnce(new Error('API error'));

      const result = await tokenService.listUserOrgs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  // =============================================================================
  // GitHub API - List Repos for Owner
  // =============================================================================

  describe('listReposForOwner', () => {
    it('returns repos for authenticated user using affiliation filter', async () => {
      await saveTestToken(tokenService);

      const result = await tokenService.listReposForOwner('testuser');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
      expect(mockListForAuthenticatedUser).toHaveBeenCalledWith(
        expect.objectContaining({ affiliation: 'owner' })
      );
    });

    it('returns repos for organization', async () => {
      await saveTestToken(tokenService);

      // Mock to return a different user (so owner is treated as org)
      mockGetAuthenticated.mockResolvedValueOnce({
        data: { login: 'testuser', id: 12345, avatar_url: 'url', name: 'User' },
      });

      const result = await tokenService.listReposForOwner('test-org');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('org-repo');
        expect(result.value[0].owner.login).toBe('test-org');
      }
      expect(mockListForOrg).toHaveBeenCalledWith(expect.objectContaining({ org: 'test-org' }));
    });

    it('returns error when no token is configured', async () => {
      const result = await tokenService.listReposForOwner('testuser');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('handles API errors when listing org repos', async () => {
      await saveTestToken(tokenService);

      mockGetAuthenticated.mockResolvedValueOnce({
        data: { login: 'testuser', id: 12345, avatar_url: 'url', name: 'User' },
      });
      mockListForOrg.mockRejectedValueOnce(new Error('Organization not found'));

      const result = await tokenService.listReposForOwner('nonexistent-org');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('handles null/undefined optional fields in repo data', async () => {
      await saveTestToken(tokenService);

      mockGetAuthenticated.mockResolvedValueOnce({
        data: { login: 'testuser', id: 12345, avatar_url: 'url', name: 'User' },
      });
      mockListForOrg.mockResolvedValueOnce({
        data: [
          {
            id: 200,
            name: 'minimal-repo',
            full_name: 'test-org/minimal-repo',
            private: false,
            owner: { login: 'test-org', avatar_url: 'url' },
            default_branch: null, // Null default branch
            description: null,
            clone_url: null, // Null clone URL
            updated_at: null,
            stargazers_count: null,
            is_template: null,
          },
        ],
      });

      const result = await tokenService.listReposForOwner('test-org');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value[0].default_branch).toBe('main'); // Default fallback
        expect(result.value[0].clone_url).toBe(''); // Empty string fallback
        expect(result.value[0].updated_at).toBe('');
        expect(result.value[0].stargazers_count).toBe(0);
        expect(result.value[0].is_template).toBe(false);
      }
    });
  });

  // =============================================================================
  // Error Handling - handleOctokitError
  // =============================================================================

  describe('error handling', () => {
    it('marks token as invalid on 401 error via getRepository', async () => {
      await saveTestToken(tokenService);

      // Verify token is initially valid
      const infoBefore = await tokenService.getTokenInfo();
      expect(infoBefore.ok).toBe(true);
      if (infoBefore.ok && infoBefore.value) {
        expect(infoBefore.value.isValid).toBe(true);
      }

      // Trigger 401 error
      const error = new Error('Bad credentials') as Error & { status: number };
      error.status = 401;
      mockReposGet.mockRejectedValueOnce(error);

      await tokenService.getRepository('testuser', 'test-repo');

      // Token should now be marked as invalid in the database
      const db = getTestDb();
      const tokens = await db.query.githubTokens.findFirst();
      expect(tokens?.isValid).toBe(false);
    });

    it('handles non-Error objects in error handler', async () => {
      await saveTestToken(tokenService);

      mockReposGet.mockRejectedValueOnce('String error');

      const result = await tokenService.getRepository('testuser', 'test-repo');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('String error');
      }
    });
  });
});
