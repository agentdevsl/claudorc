/**
 * Terraform routes
 */

import { Hono } from 'hono';
import type { TerraformComposeService } from '../../services/terraform-compose.service.js';
import type { TerraformRegistryService } from '../../services/terraform-registry.service.js';
import { isValidId, json } from '../shared.js';

interface TerraformDeps {
  terraformRegistryService: TerraformRegistryService;
  terraformComposeService: TerraformComposeService;
}

export function createTerraformRoutes({
  terraformRegistryService,
  terraformComposeService,
}: TerraformDeps) {
  const app = new Hono();

  // GET /registries — list all registries
  app.get('/registries', async (_c) => {
    try {
      const result = await terraformRegistryService.listRegistries();
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({
        ok: true,
        data: {
          items: result.value.map((r) => ({
            id: r.id,
            name: r.name,
            orgName: r.orgName,
            tokenSettingKey: r.tokenSettingKey,
            status: r.status,
            lastSyncedAt: r.lastSyncedAt,
            syncError: r.syncError,
            moduleCount: r.moduleCount,
            syncIntervalMinutes: r.syncIntervalMinutes,
            nextSyncAt: r.nextSyncAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          })),
          totalCount: result.value.length,
        },
      });
    } catch (error) {
      console.error('[Terraform] List registries error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list registries' } },
        500
      );
    }
  });

  // POST /registries — create registry
  app.post('/registries', async (c) => {
    let body: {
      name: string;
      orgName: string;
      tokenSettingKey: string;
      syncIntervalMinutes?: number;
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
      if (!body.orgName) {
        return json(
          {
            ok: false,
            error: { code: 'MISSING_ORG', message: 'Organization name is required' },
          },
          400
        );
      }
      if (!body.tokenSettingKey) {
        return json(
          {
            ok: false,
            error: { code: 'MISSING_TOKEN_KEY', message: 'Token setting key is required' },
          },
          400
        );
      }

      const result = await terraformRegistryService.createRegistry(body);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value }, 201);
    } catch (error) {
      console.error('[Terraform] Create registry error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to create registry' } },
        500
      );
    }
  });

  // GET /registries/:id — get registry detail
  app.get('/registries/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid registry ID format' } },
        400
      );
    }

    try {
      const result = await terraformRegistryService.getRegistryById(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Terraform] Get registry error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to get registry' } },
        500
      );
    }
  });

  // DELETE /registries/:id — delete registry
  app.delete('/registries/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid registry ID format' } },
        400
      );
    }

    try {
      const result = await terraformRegistryService.deleteRegistry(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: { deleted: true } });
    } catch (error) {
      console.error('[Terraform] Delete registry error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to delete registry' } },
        500
      );
    }
  });

  // POST /registries/:id/sync — trigger manual sync
  app.post('/registries/:id/sync', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid registry ID format' } },
        400
      );
    }

    try {
      console.log(`[Terraform] Syncing registry ${id}`);
      const result = await terraformRegistryService.sync(id);
      if (!result.ok) {
        console.error(`[Terraform] Sync failed for ${id}:`, result.error);
        return json({ ok: false, error: result.error }, result.error.status);
      }

      console.log(`[Terraform] Synced ${result.value.moduleCount} modules for ${id}`);
      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Terraform] Sync error:', error);
      return json(
        { ok: false, error: { code: 'SYNC_ERROR', message: 'Failed to sync registry' } },
        500
      );
    }
  });

  // GET /modules — list all modules
  app.get('/modules', async (c) => {
    try {
      const search = c.req.query('search') ?? undefined;
      const provider = c.req.query('provider') ?? undefined;
      const registryId = c.req.query('registryId') ?? undefined;
      const limit = parseInt(c.req.query('limit') ?? '50', 10);

      const result = await terraformRegistryService.listModules({
        search,
        provider,
        registryId,
        limit,
      });
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
      console.error('[Terraform] List modules error:', error);
      return json(
        { ok: false, error: { code: 'DB_ERROR', message: 'Failed to list modules' } },
        500
      );
    }
  });

  // GET /modules/:id — module detail
  app.get('/modules/:id', async (c) => {
    const id = c.req.param('id');

    if (!isValidId(id)) {
      return json(
        { ok: false, error: { code: 'INVALID_ID', message: 'Invalid module ID format' } },
        400
      );
    }

    try {
      const result = await terraformRegistryService.getModuleById(id);
      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return json({ ok: true, data: result.value });
    } catch (error) {
      console.error('[Terraform] Get module error:', error);
      return json({ ok: false, error: { code: 'DB_ERROR', message: 'Failed to get module' } }, 500);
    }
  });

  // POST /compose — streaming composition
  app.post('/compose', async (c) => {
    let body: {
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      sessionId?: string;
      registryId?: string;
    };
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

    if (!body.messages || body.messages.length === 0) {
      return json(
        {
          ok: false,
          error: { code: 'MISSING_MESSAGES', message: 'At least one message is required' },
        },
        400
      );
    }

    try {
      const result = await terraformComposeService.compose(
        body.sessionId,
        body.messages,
        body.registryId
      );

      if (!result.ok) {
        return json({ ok: false, error: result.error }, result.error.status);
      }

      return new Response(result.value, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    } catch (error) {
      console.error('[Terraform] Compose error:', error);
      return json(
        { ok: false, error: { code: 'COMPOSE_ERROR', message: 'Failed to compose Terraform' } },
        500
      );
    }
  });

  return app;
}
