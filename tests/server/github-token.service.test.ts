/**
 * Tests for GitHubTokenService (src/server/github-token.service.ts)
 *
 * Tests cover:
 * - Token saving with validation, encryption, and storage
 * - Token retrieval and decryption with masking
 * - Token validation with GitHub API
 * - Token deletion
 * - Token revalidation
 * - Error handling (invalid format, validation failures, storage errors)
 * - Octokit instance creation
 * - User organizations listing
 * - Repository listing
 * - Repository creation from template
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GitHubTokenService, type TokenInfo } from '@/server/github-token.service';
import { getTestDb } from '../helpers/database';

// Mock the crypto module
vi.mock('@/server/crypto', () => ({
  encryptToken: vi.fn(async (token: string) => `encrypted_${token}`),
  decryptToken: vi.fn(async (encryptedToken: string) => encryptedToken.replace('encrypted_', '')),
  maskToken: vi.fn((token: string) => `${token.slice(0, 4)}********${token.slice(-4)}`),
  isValidPATFormat: vi.fn(
    (token: string) => token.startsWith('ghp_') || token.startsWith('github_pat_')
  ),
}));

// Mock Octokit
const mockGetAuthenticated = vi.fn();
const mockListForAuthenticatedUser = vi.fn();
const mockListForOrg = vi.fn();
const mockCreateUsingTemplate = vi.fn();
const mockOrgListForAuthenticatedUser = vi.fn();

// Use a class-based mock for Octokit
vi.mock('octokit', () => {
  return {
    Octokit: class MockOctokit {
      rest = {
        users: {
          getAuthenticated: mockGetAuthenticated,
        },
        repos: {
          listForAuthenticatedUser: mockListForAuthenticatedUser,
          listForOrg: mockListForOrg,
          createUsingTemplate: mockCreateUsingTemplate,
        },
        orgs: {
          listForAuthenticatedUser: mockOrgListForAuthenticatedUser,
        },
      };
    },
  };
});

describe('GitHubTokenService', () => {
  let service: GitHubTokenService;

  beforeEach(() => {
    vi.clearAllMocks();
    const db = getTestDb();
    // Cast to any to work around type mismatch between test db and production db
    service = new GitHubTokenService(db as any);
  });

  // =============================================================================
  // Token Format Validation Tests
  // =============================================================================

  describe('saveToken - Format Validation', () => {
    it('rejects tokens with invalid format (not starting with ghp_ or github_pat_)', async () => {
      const result = await service.saveToken('invalid_token_format');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_FORMAT');
        expect(result.error.message).toContain('Invalid token format');
      }
    });

    it('rejects empty tokens', async () => {
      const result = await service.saveToken('');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('rejects tokens with partial prefix', async () => {
      const result = await service.saveToken('ghp');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });
  });

  // =============================================================================
  // Token Saving Tests
  // =============================================================================

  describe('saveToken - GitHub API Validation', () => {
    it('saves token when GitHub API validation succeeds with ghp_ prefix', async () => {
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });

      const result = await service.saveToken('ghp_valid_token_abc123');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.githubLogin).toBe('testuser');
        expect(result.value.isValid).toBe(true);
        expect(result.value.maskedToken).toContain('ghp_');
      }
    });

    it('saves token when GitHub API validation succeeds with github_pat_ prefix', async () => {
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'anotheruser',
          id: 67890,
          avatar_url: 'https://example.com/avatar2.png',
          name: null,
        },
      });

      const result = await service.saveToken('github_pat_valid_token_xyz789');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.githubLogin).toBe('anotheruser');
        expect(result.value.isValid).toBe(true);
      }
    });

    it('returns validation error when GitHub API returns 401', async () => {
      const authError = new Error('Bad credentials');
      (authError as any).status = 401;
      mockGetAuthenticated.mockRejectedValueOnce(authError);

      const result = await service.saveToken('ghp_invalid_credentials_token');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Invalid token');
      }
    });

    it('returns validation error when GitHub API returns other errors', async () => {
      mockGetAuthenticated.mockRejectedValueOnce(new Error('Network error'));

      const result = await service.saveToken('ghp_network_error_token');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Failed to validate token');
      }
    });

    it('replaces existing token when saving a new one', async () => {
      // First save
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'user1',
          id: 111,
          avatar_url: 'https://example.com/avatar1.png',
          name: 'User One',
        },
      });
      await service.saveToken('ghp_first_token_123');

      // Second save
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'user2',
          id: 222,
          avatar_url: 'https://example.com/avatar2.png',
          name: 'User Two',
        },
      });
      const result = await service.saveToken('ghp_second_token_456');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.githubLogin).toBe('user2');
      }

      // Verify only one token exists
      const db = getTestDb();
      const tokens = await db.query.githubTokens.findMany();
      expect(tokens).toHaveLength(1);
      expect(tokens[0]?.githubLogin).toBe('user2');
    });
  });

  // =============================================================================
  // Token Retrieval Tests
  // =============================================================================

  describe('getTokenInfo', () => {
    it('returns null when no token is saved', async () => {
      const result = await service.getTokenInfo();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('returns token info with masked token when token exists', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_token_to_retrieve_123');

      const result = await service.getTokenInfo();

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.githubLogin).toBe('testuser');
        expect(result.value.maskedToken).toContain('********');
        expect(result.value.isValid).toBe(true);
        expect(result.value.id).toBeDefined();
        expect(result.value.createdAt).toBeDefined();
      }
    });
  });

  describe('getDecryptedToken', () => {
    it('returns null when no token is saved', async () => {
      const result = await service.getDecryptedToken();
      expect(result).toBeNull();
    });

    it('returns decrypted token when token exists', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_decrypted_test_token');

      const result = await service.getDecryptedToken();
      expect(result).toBe('ghp_decrypted_test_token');
    });
  });

  // =============================================================================
  // Token Deletion Tests
  // =============================================================================

  describe('deleteToken', () => {
    it('deletes existing token successfully', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_token_to_delete_123');

      const deleteResult = await service.deleteToken();
      expect(deleteResult.ok).toBe(true);

      // Verify token is deleted
      const getResult = await service.getTokenInfo();
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value).toBeNull();
      }
    });

    it('succeeds even when no token exists (idempotent)', async () => {
      const result = await service.deleteToken();
      expect(result.ok).toBe(true);
    });
  });

  // =============================================================================
  // Token Revalidation Tests
  // =============================================================================

  describe('revalidateToken', () => {
    it('returns NOT_FOUND when no token is saved', async () => {
      const result = await service.revalidateToken();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('No token saved');
      }
    });

    it('revalidates and returns true when token is still valid', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_revalidation_token_123');

      // Mock successful revalidation
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });

      const result = await service.revalidateToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('revalidates and returns false when token becomes invalid', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_soon_invalid_token_123');

      // Mock failed revalidation (token revoked)
      const authError = new Error('Bad credentials');
      (authError as any).status = 401;
      mockGetAuthenticated.mockRejectedValueOnce(authError);

      const result = await service.revalidateToken();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(false);
      }

      // Verify token is marked as invalid in database
      const db = getTestDb();
      const token = await db.query.githubTokens.findFirst();
      expect(token?.isValid).toBe(false);
    });

    it('updates lastValidatedAt timestamp on revalidation', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_timestamp_test_token');

      const db = getTestDb();
      const initialToken = await db.query.githubTokens.findFirst();
      const initialTimestamp = initialToken?.lastValidatedAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Revalidate
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.revalidateToken();

      const updatedToken = await db.query.githubTokens.findFirst();
      expect(updatedToken?.lastValidatedAt).not.toBe(initialTimestamp);
    });
  });

  // =============================================================================
  // Octokit Instance Tests
  // =============================================================================

  describe('getOctokit', () => {
    it('returns null when no token is saved', async () => {
      const result = await service.getOctokit();
      expect(result).toBeNull();
    });

    it('returns Octokit instance when token exists', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_octokit_test_token');

      const result = await service.getOctokit();
      expect(result).not.toBeNull();
      expect(result).toHaveProperty('rest');
    });
  });

  // =============================================================================
  // List User Orgs Tests
  // =============================================================================

  describe('listUserOrgs', () => {
    it('returns NOT_FOUND when no token is configured', async () => {
      const result = await service.listUserOrgs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
        expect(result.error.message).toBe('No GitHub token configured');
      }
    });

    it('returns user and organizations when token is configured', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_org_list_token');

      // Mock listUserOrgs calls
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          avatar_url: 'https://example.com/user-avatar.png',
        },
      });
      mockOrgListForAuthenticatedUser.mockResolvedValueOnce({
        data: [
          { login: 'org1', avatar_url: 'https://example.com/org1.png' },
          { login: 'org2', avatar_url: 'https://example.com/org2.png' },
        ],
      });

      const result = await service.listUserOrgs();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(3);
        expect(result.value[0]).toEqual({
          login: 'testuser',
          avatar_url: 'https://example.com/user-avatar.png',
          type: 'user',
        });
        expect(result.value[1]).toEqual({
          login: 'org1',
          avatar_url: 'https://example.com/org1.png',
          type: 'org',
        });
      }
    });
  });

  // =============================================================================
  // List Repos Tests
  // =============================================================================

  describe('listReposForOwner', () => {
    it('returns NOT_FOUND when no token is configured', async () => {
      const result = await service.listReposForOwner('someowner');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('lists repos for authenticated user (owner matches login)', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_repos_owner_token');

      // Mock the API calls for listReposForOwner
      mockGetAuthenticated.mockResolvedValueOnce({
        data: { login: 'testuser' },
      });
      mockListForAuthenticatedUser.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'repo1',
            full_name: 'testuser/repo1',
            private: false,
            owner: { login: 'testuser', avatar_url: 'https://example.com/avatar.png' },
            default_branch: 'main',
            description: 'Test repo 1',
            clone_url: 'https://github.com/testuser/repo1.git',
            updated_at: '2024-01-01T00:00:00Z',
            stargazers_count: 10,
            is_template: false,
          },
        ],
      });

      const result = await service.listReposForOwner('testuser');

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('repo1');
      }
    });
  });

  describe('listUserRepos', () => {
    it('returns NOT_FOUND when no token is configured', async () => {
      const result = await service.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('lists repos for authenticated user', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_list_repos_token');

      // Mock the API call
      mockListForAuthenticatedUser.mockResolvedValueOnce({
        data: [
          {
            id: 1,
            name: 'repo1',
            full_name: 'testuser/repo1',
            private: false,
            owner: { login: 'testuser', avatar_url: 'https://example.com/avatar.png' },
            default_branch: 'main',
            description: 'Test repo',
            clone_url: 'https://github.com/testuser/repo1.git',
            updated_at: '2024-01-01T00:00:00Z',
            stargazers_count: 5,
            is_template: false,
          },
        ],
      });

      const result = await service.listUserRepos();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(1);
        expect(result.value[0].name).toBe('repo1');
        expect(result.value[0].full_name).toBe('testuser/repo1');
      }
    });
  });

  // =============================================================================
  // Create Repo from Template Tests
  // =============================================================================

  describe('createRepoFromTemplate', () => {
    it('returns NOT_FOUND when no token is configured', async () => {
      const result = await service.createRepoFromTemplate({
        templateOwner: 'owner',
        templateRepo: 'template',
        name: 'new-repo',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('NOT_FOUND');
      }
    });

    it('creates repo from template successfully', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_create_template_token');

      // Mock successful creation
      mockCreateUsingTemplate.mockResolvedValueOnce({
        data: {
          clone_url: 'https://github.com/testuser/new-repo.git',
          full_name: 'testuser/new-repo',
        },
      });

      const result = await service.createRepoFromTemplate({
        templateOwner: 'owner',
        templateRepo: 'template',
        name: 'new-repo',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cloneUrl).toBe('https://github.com/testuser/new-repo.git');
        expect(result.value.fullName).toBe('testuser/new-repo');
      }
    });

    it('returns VALIDATION_FAILED when repo name already exists (422)', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_template_test_token');

      // Mock 422 error
      const error = new Error('Repository creation failed: name already exists');
      (error as any).status = 422;
      mockCreateUsingTemplate.mockRejectedValueOnce(error);

      const result = await service.createRepoFromTemplate({
        templateOwner: 'owner',
        templateRepo: 'template',
        name: 'existing-repo',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('already exists');
      }
    });
  });

  // =============================================================================
  // Error Handling Tests
  // =============================================================================

  describe('handleOctokitError', () => {
    it('marks token as invalid on 401 errors during API calls', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_error_handling_token');

      // Mock 401 error on listUserRepos
      const authError = new Error('Bad credentials');
      (authError as any).status = 401;
      mockListForAuthenticatedUser.mockRejectedValueOnce(authError);

      const result = await service.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toBe('Token is no longer valid');
      }

      // Verify token is marked as invalid
      const db = getTestDb();
      const token = await db.query.githubTokens.findFirst();
      expect(token?.isValid).toBe(false);
    });

    it('returns VALIDATION_FAILED with status code for other HTTP errors', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_http_error_token');

      // Mock 403 error
      const forbiddenError = new Error('Forbidden');
      (forbiddenError as any).status = 403;
      mockListForAuthenticatedUser.mockRejectedValueOnce(forbiddenError);

      const result = await service.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('403');
      }
    });

    it('handles non-HTTP errors gracefully', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_generic_error_token');

      // Mock generic error
      mockListForAuthenticatedUser.mockRejectedValueOnce(new Error('Connection refused'));

      const result = await service.listUserRepos();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Connection refused');
      }
    });
  });

  // =============================================================================
  // TokenInfo Structure Tests
  // =============================================================================

  describe('TokenInfo structure', () => {
    it('returns all expected fields in TokenInfo', async () => {
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'structuretest',
          id: 99999,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Structure Test User',
        },
      });

      const saveResult = await service.saveToken('ghp_structure_test_token');

      expect(saveResult.ok).toBe(true);
      if (saveResult.ok) {
        const tokenInfo: TokenInfo = saveResult.value;
        expect(tokenInfo).toHaveProperty('id');
        expect(tokenInfo).toHaveProperty('maskedToken');
        expect(tokenInfo).toHaveProperty('githubLogin');
        expect(tokenInfo).toHaveProperty('isValid');
        expect(tokenInfo).toHaveProperty('lastValidatedAt');
        expect(tokenInfo).toHaveProperty('createdAt');

        expect(typeof tokenInfo.id).toBe('string');
        expect(typeof tokenInfo.maskedToken).toBe('string');
        expect(tokenInfo.githubLogin).toBe('structuretest');
        expect(tokenInfo.isValid).toBe(true);
        expect(tokenInfo.lastValidatedAt).not.toBeNull();
        expect(typeof tokenInfo.createdAt).toBe('string');
      }
    });
  });

  // =============================================================================
  // Additional Error Path Tests
  // =============================================================================

  describe('listUserOrgs error handling', () => {
    it('handles API errors gracefully', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_orgs_error_token');

      // Mock error on user info call
      const apiError = new Error('API rate limit exceeded');
      (apiError as any).status = 403;
      mockGetAuthenticated.mockRejectedValueOnce(apiError);

      const result = await service.listUserOrgs();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('403');
      }
    });
  });

  describe('listReposForOwner error handling', () => {
    it('handles API errors for org repos', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_org_repos_error_token');

      // Mock the API calls - user is different from owner (org case)
      mockGetAuthenticated.mockResolvedValueOnce({
        data: { login: 'testuser' },
      });

      // Mock error when fetching org repos
      const apiError = new Error('Organization not found');
      (apiError as any).status = 404;
      mockListForOrg.mockRejectedValueOnce(apiError);

      const result = await service.listReposForOwner('some-org');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('404');
      }
    });
  });

  describe('createRepoFromTemplate additional error handling', () => {
    it('handles non-422 HTTP errors', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_template_error_token');

      // Mock 500 error
      const serverError = new Error('Internal Server Error');
      (serverError as any).status = 500;
      mockCreateUsingTemplate.mockRejectedValueOnce(serverError);

      const result = await service.createRepoFromTemplate({
        templateOwner: 'owner',
        templateRepo: 'template',
        name: 'new-repo',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('500');
      }
    });

    it('handles non-Error exceptions', async () => {
      // Save a token first
      mockGetAuthenticated.mockResolvedValueOnce({
        data: {
          login: 'testuser',
          id: 12345,
          avatar_url: 'https://example.com/avatar.png',
          name: 'Test User',
        },
      });
      await service.saveToken('ghp_template_non_error_token');

      // Mock throwing a string instead of Error
      mockCreateUsingTemplate.mockRejectedValueOnce('Unknown error occurred');

      const result = await service.createRepoFromTemplate({
        templateOwner: 'owner',
        templateRepo: 'template',
        name: 'new-repo',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
        expect(result.error.message).toContain('Unknown error occurred');
      }
    });
  });
});
