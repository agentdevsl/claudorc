/**
 * API Key routes
 */

import { Hono } from 'hono';
import type { ApiKeyService } from '../../services/api-key.service.js';
import { json } from '../shared.js';

interface ApiKeysDeps {
  apiKeyService: ApiKeyService;
}

export function createApiKeysRoutes({ apiKeyService }: ApiKeysDeps) {
  const app = new Hono();

  // GET /api/keys/:service
  app.get('/:service', async (c) => {
    const service = c.req.param('service');

    const result = await apiKeyService.getKeyInfo(service);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 500);
    }

    return json({ ok: true, data: { keyInfo: result.value } });
  });

  // POST /api/keys/:service
  app.post('/:service', async (c) => {
    const service = c.req.param('service');
    const body = (await c.req.json()) as { key: string };

    if (!body.key) {
      return json(
        { ok: false, error: { code: 'MISSING_PARAMS', message: 'API key is required' } },
        400
      );
    }

    const result = await apiKeyService.saveKey(service, body.key);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 400);
    }

    return json({ ok: true, data: { keyInfo: result.value } });
  });

  // DELETE /api/keys/:service
  app.delete('/:service', async (c) => {
    const service = c.req.param('service');

    const result = await apiKeyService.deleteKey(service);

    if (!result.ok) {
      return json({ ok: false, error: result.error }, 500);
    }

    return json({ ok: true, data: null });
  });

  return app;
}
