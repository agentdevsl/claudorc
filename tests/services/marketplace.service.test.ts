import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { githubInstallations, githubTokens } from '../../src/db/schema/github';
import { type CachedPlugin, marketplaces } from '../../src/db/schema/marketplaces';
import { MarketplaceService } from '../../src/services/marketplace.service';
import { clearTestDatabase, getTestDb, setupTestDatabase } from '../helpers/database';

// Mock the GitHub modules
vi.mock('../../src/lib/github/client', () => ({
  getInstallationOctokit: vi.fn(),
  createOctokitFromToken: vi.fn(),
}));

vi.mock('../../src/lib/github/marketplace-sync', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/github/marketplace-sync')>();
  return {
    ...actual,
    syncMarketplaceFromGitHub: vi.fn(),
  };
});

vi.mock('../../src/server/crypto', () => ({
  decryptToken: vi.fn().mockResolvedValue('decrypted-token'),
}));

describe('MarketplaceService', () => {
  let marketplaceService: MarketplaceService;

  beforeEach(async () => {
    await setupTestDatabase();
    const db = getTestDb();
    marketplaceService = new MarketplaceService(db as any);
    // Clear all marketplaces (including seeded one) for clean tests
    await db.delete(marketplaces);
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await clearTestDatabase();
  });

  // =============================================================================
  // Seed Default Marketplace (3 tests)
  // =============================================================================

  describe('seedDefaultMarketplace', () => {
    it('creates default marketplace when none exists', async () => {
      const result = await marketplaceService.seedDefaultMarketplace();

      expect(result.ok).toBe(true);
      if (result.ok && result.value) {
        expect(result.value.name).toBe('Claude Plugins Official');
        expect(result.value.githubOwner).toBe('anthropics');
        expect(result.value.githubRepo).toBe('claude-plugins-official');
        expect(result.value.isDefault).toBe(true);
        expect(result.value.isEnabled).toBe(true);
        expect(result.value.status).toBe('active');
      }
    });

    it('returns null when default marketplace already exists by ID', async () => {
      // Seed first time
      await marketplaceService.seedDefaultMarketplace();

      // Seed second time should return null
      const result = await marketplaceService.seedDefaultMarketplace();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });

    it('returns null when legacy default marketplace exists', async () => {
      const db = getTestDb();
      // Create a legacy default marketplace with different ID
      await db.insert(marketplaces).values({
        id: 'legacy-default',
        name: 'Legacy Default',
        githubOwner: 'legacy',
        githubRepo: 'legacy-repo',
        isDefault: true,
        isEnabled: true,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.seedDefaultMarketplace();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  // =============================================================================
  // Create Marketplace (5 tests)
  // =============================================================================

  describe('create', () => {
    it('creates marketplace with GitHub URL', async () => {
      const result = await marketplaceService.create({
        name: 'Test Marketplace',
        githubUrl: 'https://github.com/test-org/test-plugins',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Test Marketplace');
        expect(result.value.githubOwner).toBe('test-org');
        expect(result.value.githubRepo).toBe('test-plugins');
        expect(result.value.branch).toBe('main');
        expect(result.value.pluginsPath).toBe('plugins');
        expect(result.value.isDefault).toBe(false);
        expect(result.value.isEnabled).toBe(true);
      }
    });

    it('creates marketplace with owner and repo', async () => {
      const result = await marketplaceService.create({
        name: 'Direct Repo Marketplace',
        githubOwner: 'my-org',
        githubRepo: 'my-plugins',
        branch: 'develop',
        pluginsPath: 'skills',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Direct Repo Marketplace');
        expect(result.value.githubOwner).toBe('my-org');
        expect(result.value.githubRepo).toBe('my-plugins');
        expect(result.value.branch).toBe('develop');
        expect(result.value.pluginsPath).toBe('skills');
      }
    });

    it('rejects invalid GitHub URL', async () => {
      const result = await marketplaceService.create({
        name: 'Invalid URL Marketplace',
        githubUrl: 'not-a-valid-url',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_INVALID_URL');
        expect(result.error.status).toBe(400);
      }
    });

    it('rejects missing repository info', async () => {
      const result = await marketplaceService.create({
        name: 'Missing Info Marketplace',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_MISSING_REPO_INFO');
        expect(result.error.status).toBe(400);
      }
    });

    it('rejects duplicate marketplace', async () => {
      // Create first marketplace
      await marketplaceService.create({
        name: 'First Marketplace',
        githubOwner: 'duplicate-org',
        githubRepo: 'duplicate-repo',
      });

      // Try to create duplicate
      const result = await marketplaceService.create({
        name: 'Duplicate Marketplace',
        githubOwner: 'duplicate-org',
        githubRepo: 'duplicate-repo',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_ALREADY_EXISTS');
        expect(result.error.status).toBe(409);
      }
    });
  });

  // =============================================================================
  // Get Marketplace by ID (2 tests)
  // =============================================================================

  describe('getById', () => {
    it('retrieves marketplace by ID', async () => {
      const createResult = await marketplaceService.create({
        name: 'Get By ID Test',
        githubOwner: 'test-org',
        githubRepo: 'test-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await marketplaceService.getById(createResult.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(createResult.value.id);
        expect(result.value.name).toBe('Get By ID Test');
      }
    });

    it('returns error for non-existent marketplace', async () => {
      const result = await marketplaceService.getById('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_NOT_FOUND');
        expect(result.error.status).toBe(404);
      }
    });
  });

  // =============================================================================
  // List Marketplaces (3 tests)
  // =============================================================================

  describe('list', () => {
    it('lists enabled marketplaces with pagination', async () => {
      // Create several marketplaces
      for (let i = 0; i < 5; i++) {
        await marketplaceService.create({
          name: `Marketplace ${i}`,
          githubOwner: `org-${i}`,
          githubRepo: `repo-${i}`,
        });
      }

      const result = await marketplaceService.list({ limit: 3, offset: 0 });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
      }
    });

    it('excludes disabled marketplaces by default', async () => {
      const db = getTestDb();

      // Create an enabled marketplace
      await marketplaceService.create({
        name: 'Enabled Marketplace',
        githubOwner: 'enabled-org',
        githubRepo: 'enabled-repo',
      });

      // Create a disabled marketplace directly
      await db.insert(marketplaces).values({
        id: 'disabled-mp',
        name: 'Disabled Marketplace',
        githubOwner: 'disabled-org',
        githubRepo: 'disabled-repo',
        isDefault: false,
        isEnabled: false,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.list();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].name).toBe('Enabled Marketplace');
      }
    });

    it('includes disabled marketplaces when requested', async () => {
      const db = getTestDb();

      // Create an enabled marketplace
      await marketplaceService.create({
        name: 'Enabled Marketplace',
        githubOwner: 'enabled-org',
        githubRepo: 'enabled-repo',
      });

      // Create a disabled marketplace
      await db.insert(marketplaces).values({
        id: 'disabled-mp',
        name: 'Disabled Marketplace',
        githubOwner: 'disabled-org',
        githubRepo: 'disabled-repo',
        isDefault: false,
        isEnabled: false,
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.list({ includeDisabled: true });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
      }
    });
  });

  // =============================================================================
  // Update Marketplace (3 tests)
  // =============================================================================

  describe('update', () => {
    it('updates marketplace fields', async () => {
      const createResult = await marketplaceService.create({
        name: 'Original Name',
        githubOwner: 'test-org',
        githubRepo: 'test-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await marketplaceService.update(createResult.value.id, {
        name: 'Updated Name',
        branch: 'develop',
        pluginsPath: 'skills',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.name).toBe('Updated Name');
        expect(result.value.branch).toBe('develop');
        expect(result.value.pluginsPath).toBe('skills');
        // updatedAt should be a valid ISO timestamp (timing can cause same value)
        expect(result.value.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      }
    });

    it('prevents disabling default marketplace', async () => {
      // Seed the default marketplace
      await marketplaceService.seedDefaultMarketplace();

      const result = await marketplaceService.update('anthropic-official-marketplace', {
        isEnabled: false,
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_CANNOT_DISABLE_DEFAULT');
        expect(result.error.status).toBe(403);
      }
    });

    it('returns error for non-existent marketplace', async () => {
      const result = await marketplaceService.update('non-existent-id', {
        name: 'New Name',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_NOT_FOUND');
      }
    });
  });

  // =============================================================================
  // Delete Marketplace (3 tests)
  // =============================================================================

  describe('delete', () => {
    it('deletes a marketplace', async () => {
      const createResult = await marketplaceService.create({
        name: 'To Delete',
        githubOwner: 'delete-org',
        githubRepo: 'delete-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await marketplaceService.delete(createResult.value.id);

      expect(result.ok).toBe(true);

      // Verify it's deleted
      const getResult = await marketplaceService.getById(createResult.value.id);
      expect(getResult.ok).toBe(false);
    });

    it('prevents deleting default marketplace', async () => {
      await marketplaceService.seedDefaultMarketplace();

      const result = await marketplaceService.delete('anthropic-official-marketplace');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_CANNOT_DELETE_DEFAULT');
        expect(result.error.status).toBe(403);
      }
    });

    it('returns error for non-existent marketplace', async () => {
      const result = await marketplaceService.delete('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_NOT_FOUND');
        expect(result.error.status).toBe(404);
      }
    });
  });

  // =============================================================================
  // Sync Marketplace (4 tests)
  // =============================================================================

  describe('sync', () => {
    it('syncs marketplace using GitHub App installation', async () => {
      const db = getTestDb();
      const { syncMarketplaceFromGitHub } = await import('../../src/lib/github/marketplace-sync');
      const { getInstallationOctokit } = await import('../../src/lib/github/client');

      // Create a marketplace
      const createResult = await marketplaceService.create({
        name: 'Sync Test',
        githubOwner: 'sync-org',
        githubRepo: 'sync-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      // Create GitHub installation
      await db.insert(githubInstallations).values({
        id: 'test-installation',
        installationId: '12345',
        accountLogin: 'test-account',
        accountType: 'Organization',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock the GitHub sync
      const mockOctokit = { rest: {} };
      vi.mocked(getInstallationOctokit).mockResolvedValue(mockOctokit as any);
      vi.mocked(syncMarketplaceFromGitHub).mockResolvedValue({
        ok: true,
        value: {
          plugins: [
            { id: 'plugin-1', name: 'Plugin One', description: 'First plugin' },
            { id: 'plugin-2', name: 'Plugin Two', description: 'Second plugin' },
          ],
          sha: 'abc123',
        },
      });

      const result = await marketplaceService.sync(createResult.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pluginCount).toBe(2);
        expect(result.value.sha).toBe('abc123');
        expect(result.value.marketplaceId).toBe(createResult.value.id);
      }
    });

    it('syncs marketplace using PAT token when no installation', async () => {
      const db = getTestDb();
      const { syncMarketplaceFromGitHub } = await import('../../src/lib/github/marketplace-sync');
      const { createOctokitFromToken } = await import('../../src/lib/github/client');

      // Create a marketplace
      const createResult = await marketplaceService.create({
        name: 'PAT Sync Test',
        githubOwner: 'pat-org',
        githubRepo: 'pat-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      // Create GitHub token (no installation)
      await db.insert(githubTokens).values({
        id: 'test-token',
        encryptedToken: 'encrypted-test-token',
        tokenType: 'pat',
        isValid: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock the GitHub sync
      const mockOctokit = { rest: {} };
      vi.mocked(createOctokitFromToken).mockReturnValue(mockOctokit as any);
      vi.mocked(syncMarketplaceFromGitHub).mockResolvedValue({
        ok: true,
        value: {
          plugins: [{ id: 'plugin-1', name: 'Plugin One' }],
          sha: 'def456',
        },
      });

      const result = await marketplaceService.sync(createResult.value.id);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pluginCount).toBe(1);
        expect(result.value.sha).toBe('def456');
      }
    });

    it('returns error when no GitHub authentication found', async () => {
      // Create a marketplace
      const createResult = await marketplaceService.create({
        name: 'No Auth Test',
        githubOwner: 'no-auth-org',
        githubRepo: 'no-auth-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      const result = await marketplaceService.sync(createResult.value.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_SYNC_FAILED');
        expect(result.error.message).toContain('No GitHub authentication found');
      }
    });

    it('returns error for non-existent marketplace', async () => {
      const result = await marketplaceService.sync('non-existent-id');

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_NOT_FOUND');
      }
    });
  });

  // =============================================================================
  // List All Plugins (4 tests)
  // =============================================================================

  describe('listAllPlugins', () => {
    const testPlugins: CachedPlugin[] = [
      { id: 'plugin-a', name: 'Plugin A', description: 'First plugin', category: 'development' },
      { id: 'plugin-b', name: 'Plugin B', description: 'Second plugin', category: 'testing' },
      { id: 'plugin-c', name: 'Plugin C', description: 'Third plugin', category: 'development' },
    ];

    beforeEach(async () => {
      const db = getTestDb();
      // Create marketplace with cached plugins (passing actual array, not JSON string)
      await db.insert(marketplaces).values({
        id: 'plugins-marketplace',
        name: 'Plugins Marketplace',
        githubOwner: 'plugins-org',
        githubRepo: 'plugins-repo',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        cachedPlugins: testPlugins,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    });

    it('lists all plugins from enabled marketplaces', async () => {
      const result = await marketplaceService.listAllPlugins();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
        expect(result.value[0].marketplaceId).toBe('plugins-marketplace');
        expect(result.value[0].marketplaceName).toBe('Plugins Marketplace');
      }
    });

    it('filters plugins by category', async () => {
      const result = await marketplaceService.listAllPlugins({ category: 'development' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(2);
        expect(result.value.every((p) => p.category === 'development')).toBe(true);
      }
    });

    it('filters plugins by search term', async () => {
      const result = await marketplaceService.listAllPlugins({ search: 'First' });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(1);
        expect(result.value[0].name).toBe('Plugin A');
      }
    });

    it('filters plugins by marketplace ID', async () => {
      const db = getTestDb();
      // Create another marketplace
      await db.insert(marketplaces).values({
        id: 'other-marketplace',
        name: 'Other Marketplace',
        githubOwner: 'other-org',
        githubRepo: 'other-repo',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        cachedPlugins: [
          { id: 'other-plugin', name: 'Other Plugin', description: 'Other marketplace plugin' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.listAllPlugins({
        marketplaceId: 'plugins-marketplace',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBe(3);
        expect(result.value.every((p) => p.marketplaceId === 'plugins-marketplace')).toBe(true);
      }
    });
  });

  // =============================================================================
  // Get Categories (2 tests)
  // =============================================================================

  describe('getCategories', () => {
    it('returns unique sorted categories from all plugins', async () => {
      const db = getTestDb();
      // Create marketplaces with plugins that have categories
      await db.insert(marketplaces).values({
        id: 'categories-marketplace-1',
        name: 'Categories Marketplace 1',
        githubOwner: 'cat-org-1',
        githubRepo: 'cat-repo-1',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        cachedPlugins: [
          { id: 'p1', name: 'P1', category: 'development' },
          { id: 'p2', name: 'P2', category: 'testing' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await db.insert(marketplaces).values({
        id: 'categories-marketplace-2',
        name: 'Categories Marketplace 2',
        githubOwner: 'cat-org-2',
        githubRepo: 'cat-repo-2',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        cachedPlugins: [
          { id: 'p3', name: 'P3', category: 'automation' },
          { id: 'p4', name: 'P4', category: 'development' }, // Duplicate category
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.getCategories();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(['automation', 'development', 'testing']);
      }
    });

    it('returns empty array when no plugins have categories', async () => {
      const db = getTestDb();
      // Create marketplace with plugins without categories
      await db.insert(marketplaces).values({
        id: 'no-categories-marketplace',
        name: 'No Categories Marketplace',
        githubOwner: 'no-cat-org',
        githubRepo: 'no-cat-repo',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        cachedPlugins: [
          { id: 'p1', name: 'Plugin 1' },
          { id: 'p2', name: 'Plugin 2' },
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const result = await marketplaceService.getCategories();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual([]);
      }
    });
  });

  // =============================================================================
  // Error Handling Edge Cases (2 tests)
  // =============================================================================

  describe('Error Handling', () => {
    it('handles sync failure from GitHub API', async () => {
      const db = getTestDb();
      const { syncMarketplaceFromGitHub } = await import('../../src/lib/github/marketplace-sync');
      const { getInstallationOctokit } = await import('../../src/lib/github/client');

      // Create a marketplace
      const createResult = await marketplaceService.create({
        name: 'Fail Sync Test',
        githubOwner: 'fail-org',
        githubRepo: 'fail-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      // Create GitHub installation
      await db.insert(githubInstallations).values({
        id: 'fail-installation',
        installationId: '99999',
        accountLogin: 'fail-account',
        accountType: 'Organization',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock sync failure
      const mockOctokit = { rest: {} };
      vi.mocked(getInstallationOctokit).mockResolvedValue(mockOctokit as any);
      vi.mocked(syncMarketplaceFromGitHub).mockResolvedValue({
        ok: false,
        error: { message: 'Repository not found' },
      });

      const result = await marketplaceService.sync(createResult.value.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_SYNC_FAILED');
        expect(result.error.message).toContain('Repository not found');
      }

      // Verify marketplace status is set to error
      const marketplace = await marketplaceService.getById(createResult.value.id);
      expect(marketplace.ok).toBe(true);
      if (marketplace.ok) {
        expect(marketplace.value.status).toBe('error');
        expect(marketplace.value.syncError).toContain('Repository not found');
      }
    });

    it('handles exception during sync', async () => {
      const db = getTestDb();
      const { getInstallationOctokit } = await import('../../src/lib/github/client');

      // Create a marketplace
      const createResult = await marketplaceService.create({
        name: 'Exception Sync Test',
        githubOwner: 'exception-org',
        githubRepo: 'exception-repo',
      });

      expect(createResult.ok).toBe(true);
      if (!createResult.ok) return;

      // Create GitHub installation
      await db.insert(githubInstallations).values({
        id: 'exception-installation',
        installationId: '88888',
        accountLogin: 'exception-account',
        accountType: 'Organization',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Mock exception
      vi.mocked(getInstallationOctokit).mockRejectedValue(new Error('Network error'));

      const result = await marketplaceService.sync(createResult.value.id);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MARKETPLACE_SYNC_FAILED');
        expect(result.error.message).toContain('Network error');
      }

      // Verify marketplace status is set to error
      const marketplace = await marketplaceService.getById(createResult.value.id);
      expect(marketplace.ok).toBe(true);
      if (marketplace.ok) {
        expect(marketplace.value.status).toBe('error');
        expect(marketplace.value.syncError).toContain('Network error');
      }
    });
  });
});
