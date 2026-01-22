import { and, desc, eq } from 'drizzle-orm';
import { githubInstallations, githubTokens } from '../db/schema/github.js';
import type { CachedPlugin, Marketplace, NewMarketplace } from '../db/schema/marketplaces.js';
import { marketplaces } from '../db/schema/marketplaces.js';
import type { MarketplaceError } from '../lib/errors/marketplace-errors.js';
import { MarketplaceErrors } from '../lib/errors/marketplace-errors.js';
import { createOctokitFromToken, getInstallationOctokit } from '../lib/github/client.js';
import {
  parseGitHubMarketplaceUrl,
  syncMarketplaceFromGitHub,
} from '../lib/github/marketplace-sync.js';
import type { Result } from '../lib/utils/result.js';
import { err, ok } from '../lib/utils/result.js';
import type { Database } from '../types/database.js';

export interface CreateMarketplaceInput {
  name: string;
  githubUrl?: string;
  githubOwner?: string;
  githubRepo?: string;
  branch?: string;
  pluginsPath?: string;
}

export interface UpdateMarketplaceInput {
  name?: string;
  branch?: string;
  pluginsPath?: string;
  isEnabled?: boolean;
}

export interface ListMarketplacesOptions {
  limit?: number;
  offset?: number;
  includeDisabled?: boolean;
}

export interface SyncResult {
  marketplaceId: string;
  pluginCount: number;
  sha: string;
  syncedAt: string;
}

export interface MarketplaceWithPlugins extends Marketplace {
  plugins: CachedPlugin[];
}

export interface AggregatedPlugin extends CachedPlugin {
  marketplaceId: string;
  marketplaceName: string;
  isEnabled: boolean;
}

export class MarketplaceService {
  constructor(private db: Database) {}

  private updateTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Seed the default official marketplace if not exists.
   * Uses a fixed ID to match the SQL migration seed.
   */
  async seedDefaultMarketplace(): Promise<Result<Marketplace | null, MarketplaceError>> {
    const DEFAULT_MARKETPLACE_ID = 'anthropic-official-marketplace';

    // Check if default marketplace already exists (by fixed ID or isDefault flag)
    const existing = await this.db.query.marketplaces.findFirst({
      where: eq(marketplaces.id, DEFAULT_MARKETPLACE_ID),
    });

    if (existing) {
      return ok(null);
    }

    // Also check for any other default marketplace (legacy)
    const legacyDefault = await this.db.query.marketplaces.findFirst({
      where: eq(marketplaces.isDefault, true),
    });

    if (legacyDefault) {
      return ok(null);
    }

    const now = this.updateTimestamp();
    const [created] = await this.db
      .insert(marketplaces)
      .values({
        id: DEFAULT_MARKETPLACE_ID,
        name: 'Claude Plugins Official',
        githubOwner: 'anthropics',
        githubRepo: 'claude-plugins-official',
        branch: 'main',
        pluginsPath: 'plugins',
        isDefault: true,
        isEnabled: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } satisfies NewMarketplace)
      .returning();

    return ok(created ?? null);
  }

  async create(input: CreateMarketplaceInput): Promise<Result<Marketplace, MarketplaceError>> {
    let owner: string;
    let repo: string;

    if (input.githubUrl) {
      const parsed = parseGitHubMarketplaceUrl(input.githubUrl);
      if (!parsed.ok) {
        return err(MarketplaceErrors.INVALID_URL(input.githubUrl));
      }
      owner = parsed.value.owner;
      repo = parsed.value.repo;
    } else if (input.githubOwner && input.githubRepo) {
      owner = input.githubOwner;
      repo = input.githubRepo;
    } else {
      return err(MarketplaceErrors.MISSING_REPO_INFO);
    }

    // Check for duplicate
    const existing = await this.db.query.marketplaces.findFirst({
      where: and(eq(marketplaces.githubOwner, owner), eq(marketplaces.githubRepo, repo)),
    });

    if (existing) {
      return err(MarketplaceErrors.ALREADY_EXISTS);
    }

    const now = this.updateTimestamp();
    const [created] = await this.db
      .insert(marketplaces)
      .values({
        name: input.name,
        githubOwner: owner,
        githubRepo: repo,
        branch: input.branch ?? 'main',
        pluginsPath: input.pluginsPath ?? 'plugins',
        isDefault: false,
        isEnabled: true,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      } satisfies NewMarketplace)
      .returning();

    if (!created) {
      return err(MarketplaceErrors.NOT_FOUND);
    }

    return ok(created);
  }

  async getById(id: string): Promise<Result<Marketplace, MarketplaceError>> {
    const marketplace = await this.db.query.marketplaces.findFirst({
      where: eq(marketplaces.id, id),
    });

    if (!marketplace) {
      return err(MarketplaceErrors.NOT_FOUND);
    }

    return ok(marketplace);
  }

  async list(options?: ListMarketplacesOptions): Promise<Result<Marketplace[], MarketplaceError>> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    const conditions = [];
    if (!options?.includeDisabled) {
      conditions.push(eq(marketplaces.isEnabled, true));
    }

    const items = await this.db.query.marketplaces.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(marketplaces.isDefault), desc(marketplaces.updatedAt)],
      limit,
      offset,
    });

    return ok(items);
  }

  async update(
    id: string,
    input: UpdateMarketplaceInput
  ): Promise<Result<Marketplace, MarketplaceError>> {
    // Don't allow disabling default marketplace
    if (input.isEnabled === false) {
      const marketplace = await this.db.query.marketplaces.findFirst({
        where: eq(marketplaces.id, id),
      });
      if (marketplace?.isDefault) {
        return err(MarketplaceErrors.CANNOT_DISABLE_DEFAULT);
      }
    }

    const updates: Partial<Marketplace> = {
      updatedAt: this.updateTimestamp(),
    };

    if (input.name !== undefined) updates.name = input.name;
    if (input.branch !== undefined) updates.branch = input.branch;
    if (input.pluginsPath !== undefined) updates.pluginsPath = input.pluginsPath;
    if (input.isEnabled !== undefined) updates.isEnabled = input.isEnabled;

    const [updated] = await this.db
      .update(marketplaces)
      .set(updates)
      .where(eq(marketplaces.id, id))
      .returning();

    if (!updated) {
      return err(MarketplaceErrors.NOT_FOUND);
    }

    return ok(updated);
  }

  async delete(id: string): Promise<Result<void, MarketplaceError>> {
    const marketplace = await this.db.query.marketplaces.findFirst({
      where: eq(marketplaces.id, id),
    });

    if (!marketplace) {
      return err(MarketplaceErrors.NOT_FOUND);
    }

    if (marketplace.isDefault) {
      return err(MarketplaceErrors.CANNOT_DELETE_DEFAULT);
    }

    await this.db.delete(marketplaces).where(eq(marketplaces.id, id));

    return ok(undefined);
  }

  /**
   * Sync plugins from a marketplace's GitHub repository
   */
  async sync(id: string): Promise<Result<SyncResult, MarketplaceError>> {
    const marketplace = await this.db.query.marketplaces.findFirst({
      where: eq(marketplaces.id, id),
    });

    if (!marketplace) {
      return err(MarketplaceErrors.NOT_FOUND);
    }

    // Mark as syncing
    await this.db
      .update(marketplaces)
      .set({ status: 'syncing', updatedAt: this.updateTimestamp() })
      .where(eq(marketplaces.id, id));

    try {
      // Get Octokit client - try GitHub App first, then PAT
      let octokit: Awaited<ReturnType<typeof getInstallationOctokit>>;

      const installation = await this.db.query.githubInstallations.findFirst({
        where: eq(githubInstallations.status, 'active'),
      });

      if (installation) {
        octokit = await getInstallationOctokit(Number(installation.installationId));
      } else {
        const tokenRecord = await this.db.query.githubTokens.findFirst({
          where: eq(githubTokens.isValid, true),
        });

        if (!tokenRecord) {
          await this.db
            .update(marketplaces)
            .set({
              status: 'error',
              syncError: 'No GitHub authentication found',
              updatedAt: this.updateTimestamp(),
            })
            .where(eq(marketplaces.id, id));
          return err(MarketplaceErrors.SYNC_FAILED('No GitHub authentication found'));
        }

        const { decryptToken } = await import('../server/crypto.js');
        const token = await decryptToken(tokenRecord.encryptedToken);
        octokit = createOctokitFromToken(token);
      }

      const syncResult = await syncMarketplaceFromGitHub({
        octokit,
        owner: marketplace.githubOwner,
        repo: marketplace.githubRepo,
        pluginsPath: marketplace.pluginsPath ?? 'plugins',
        ref: marketplace.branch ?? 'main',
      });

      if (!syncResult.ok) {
        await this.db
          .update(marketplaces)
          .set({
            status: 'error',
            syncError: syncResult.error.message,
            updatedAt: this.updateTimestamp(),
          })
          .where(eq(marketplaces.id, id));
        return err(MarketplaceErrors.SYNC_FAILED(syncResult.error.message));
      }

      const now = this.updateTimestamp();
      await this.db
        .update(marketplaces)
        .set({
          status: 'active',
          cachedPlugins: syncResult.value.plugins,
          lastSyncSha: syncResult.value.sha,
          lastSyncedAt: now,
          syncError: null,
          updatedAt: now,
        })
        .where(eq(marketplaces.id, id));

      return ok({
        marketplaceId: id,
        pluginCount: syncResult.value.plugins.length,
        sha: syncResult.value.sha,
        syncedAt: now,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.db
        .update(marketplaces)
        .set({
          status: 'error',
          syncError: errorMessage,
          updatedAt: this.updateTimestamp(),
        })
        .where(eq(marketplaces.id, id));
      return err(MarketplaceErrors.SYNC_FAILED(errorMessage));
    }
  }

  /**
   * Get all plugins from all enabled marketplaces
   */
  async listAllPlugins(options?: {
    search?: string;
    category?: string;
    marketplaceId?: string;
  }): Promise<Result<AggregatedPlugin[], MarketplaceError>> {
    const enabledMarketplaces = await this.db.query.marketplaces.findMany({
      where: eq(marketplaces.isEnabled, true),
    });

    const allPlugins: AggregatedPlugin[] = [];

    for (const marketplace of enabledMarketplaces) {
      // Filter by marketplaceId if specified
      if (options?.marketplaceId && marketplace.id !== options.marketplaceId) {
        continue;
      }

      const plugins = (marketplace.cachedPlugins ?? []) as CachedPlugin[];

      for (const plugin of plugins) {
        // Filter by category if specified
        if (options?.category && plugin.category !== options.category) {
          continue;
        }

        // Filter by search term
        if (options?.search) {
          const searchLower = options.search.toLowerCase();
          const nameMatch = plugin.name.toLowerCase().includes(searchLower);
          const descMatch = plugin.description?.toLowerCase().includes(searchLower);
          if (!nameMatch && !descMatch) {
            continue;
          }
        }

        allPlugins.push({
          ...plugin,
          marketplaceId: marketplace.id,
          marketplaceName: marketplace.name,
          isEnabled: true, // TODO: Track individual plugin enable state
        });
      }
    }

    return ok(allPlugins);
  }

  /**
   * Get unique categories across all plugins
   */
  async getCategories(): Promise<Result<string[], MarketplaceError>> {
    const enabledMarketplaces = await this.db.query.marketplaces.findMany({
      where: eq(marketplaces.isEnabled, true),
    });

    const categories = new Set<string>();

    for (const marketplace of enabledMarketplaces) {
      const plugins = (marketplace.cachedPlugins ?? []) as CachedPlugin[];
      for (const plugin of plugins) {
        if (plugin.category) {
          categories.add(plugin.category);
        }
      }
    }

    return ok(Array.from(categories).sort());
  }
}
