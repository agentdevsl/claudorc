/**
 * API Key routes
 */

import { Hono } from 'hono';
import { z } from 'zod';
import type { ApiKeyService } from '../../services/api-key.service.js';
import { json } from '../shared.js';

// Validation schemas
const saveKeySchema = z.object({
  key: z.string().min(1, 'API key is required'),
});

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
      console.error('[API Keys] Get key info error:', result.error);
      return json({ ok: false, error: result.error }, 500);
    }

    return json({ ok: true, data: { keyInfo: result.value } });
  });

  // POST /api/keys/:service
  app.post('/:service', async (c) => {
    const service = c.req.param('service');

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return json(
        { ok: false, error: { code: 'INVALID_JSON', message: 'Invalid JSON in request body' } },
        400
      );
    }

    const parsed = saveKeySchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          ok: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: parsed.error.issues[0]?.message ?? 'Invalid request',
          },
        },
        400
      );
    }

    const result = await apiKeyService.saveKey(service, parsed.data.key);

    if (!result.ok) {
      console.error('[API Keys] Save key error:', result.error);
      return json({ ok: false, error: result.error }, 400);
    }

    return json({ ok: true, data: { keyInfo: result.value } });
  });

  // DELETE /api/keys/:service
  app.delete('/:service', async (c) => {
    const service = c.req.param('service');

    const result = await apiKeyService.deleteKey(service);

    if (!result.ok) {
      console.error('[API Keys] Delete key error:', result.error);
      return json({ ok: false, error: result.error }, 500);
    }

    return json({ ok: true, data: null });
  });

  return app;
}
