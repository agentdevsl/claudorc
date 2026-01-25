/**
 * Marketplace routes
 */

import { Hono } from 'hono';
import type { MarketplaceService } from '../../services/marketplace.service.js';
import { isValidId, json } from '../shared.js';

interface MarketplacesDeps {
  marketplaceService: MarketplaceService;
}

export function createMarketplacesRoutes({ marketplaceService }: MarketplacesDeps) {
  const app = new Hono();

  // GET /api/marketplaces
  app.get('/', async (c) => {
    try {
      const limit = parseInt(c.req.query('limit') ?? '20', 10);
      const includeDisabled = c.req.query('includeDisabled') === 'true';

      const result = await marketplaceService.list({ limit, includeDisabled });
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({
        ok: true,
        data: {
          items: result.value.map((m) => ({
            id: m.id,
            name: m.name,
            githubOwner: m.githubOwner,
            githubRepo: m.githubRepo,
            branch: m.branch,
            pluginsPath: m.pluginsPath,
            isDefault: m.isDefault,
            isEnabled: m.isEnabled,
            status: m.status,
            lastSyncedAt: m.lastSyncedAt,
            syncError: m.syncError,
            pluginCount: (m.cachedPlugins ?? []).length,
            createdAt: m.createdAt,
            updatedAt: m.updatedAt,
          })),
          totalCount: result.value.length,
        },
      });
    } catch (error) {
      console.error('[Marketplaces] List error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list marketplaces' } },
        500
      );
    }
  });

  // POST /api/marketplaces
  app.post('/', async (c) => {
    let body: {
      name: string;
      githubUrl?: string;
      githubOwner?: string;
      githubRepo?: string;
      branch?: string;
      pluginsPath?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

    try {
      if (!body.name) {
        return json(
          { ok: false, error: { code: 'MISSING_NAME', message: 'Name is required' } },
          400
        );
      }

      if (!body.githubUrl && (!body.githubOwner || !body.githubRepo)) {
        return json(
          {
            ok: false,
            error: { code: 'MISSING_REPO', message: 'GitHub URL or owner/repo required' },
          },
          400
        );
      }

      const result = await marketplaceService.create(body);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value }, 201);
    } catch (error) {
      console.error('[Marketplaces] Create error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create marketplace' } },
        500
      );
    }
  });

  // POST /api/marketplaces/seed
  app.post('/seed', async (_c) => {
    try {
      const result = await marketplaceService.seedDefaultMarketplace();
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: { seeded: result.value !== null } });
    } catch (error) {
      console.error('[Marketplaces] Seed error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to seed marketplace' } },
        500
      );
    }
  });

  // GET /api/marketplaces/plugins
  app.get('/plugins', async (c) => {
    try {
      const search = c.req.query('search') ?? undefined;
      const category = c.req.query('category') ?? undefined;
      const marketplaceId = c.req.query('marketplaceId') ?? undefined;

      const result = await marketplaceService.listAllPlugins({ search, category, marketplaceId });
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({
        ok: true,
        data: {
          items: result.value,
          totalCount: result.value.length,
        },
      });
    } catch (error) {
      console.error('[Marketplaces] List plugins error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list plugins' } },
        500
      );
    }
  });

  // GET /api/marketplaces/categories
  app.get('/categories', async (_c) => {
    try {
      const result = await marketplaceService.getCategories();
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({
        ok: true,
        data: { categories: result.value },
      });
    } catch (error) {
      console.error('[Marketplaces] Get categories error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get categories' } },
        500
      );
    }
  });

  // POST /api/marketplaces/:id/sync
  app.post('/:id/sync', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid marketplace ID format' } },
        400
      );
    }

    try {
      console.log(`[Marketplaces] Syncing marketplace ${id}`);
      const result = await marketplaceService.sync(id);
      if (!result.ok) {
        console.error(`[Marketplaces] Sync failed for ${id}:`, result.error);
        return json({ ok: false, error: result.error }, result.error.status);
      }

      console.log(`[Marketplaces] Synced ${result.value.pluginCount} plugins for ${id}`);
      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Marketplaces] Sync error:', error);
      return json(
        { ok: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync marketplace' } },
        500
      );
    }
  });

  // GET /api/marketplaces/:id
  app.get('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid marketplace ID format' } },
        400
      );
    }

    try {
      const result = await marketplaceService.getById(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      const m = result.value;
      return json({
        ok: true,
        data: {
          id: m.id,
          name: m.name,
          githubOwner: m.githubOwner,
          githubRepo: m.githubRepo,
          branch: m.branch,
          pluginsPath: m.pluginsPath,
          isDefault: m.isDefault,
          isEnabled: m.isEnabled,
          status: m.status,
          lastSyncedAt: m.lastSyncedAt,
          syncError: m.syncError,
          plugins: m.cachedPlugins ?? [],
          createdAt: m.createdAt,
          updatedAt: m.updatedAt,
        },
      });
    } catch (error) {
      console.error('[Marketplaces] Get error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get marketplace' } },
        500
      );
    }
  });

  // DELETE /api/marketplaces/:id
  app.delete('/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid marketplace ID format' } },
        400
      );
    }

    try {
      const result = await marketplaceService.delete(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: { deleted: true } });
    } catch (error) {
      console.error('[Marketplaces] Delete error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete marketplace' } },
        500
      );
    }
  });

  return app;
}
