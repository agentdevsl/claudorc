/**
 * Settings routes
 */

import { eq, or } from 'drizzle-orm';
import { Hono } from 'hono';
import * as schema from '../../db/schema/index.js';
import type { Database } from '../../types/database.js';
import { json } from '../shared.js';

interface SettingsDeps {
  db: Database;
}

export function createSettingsRoutes({ db }: SettingsDeps) {
  const app = new Hono();

  // GET /api/settings
  app.get('/', async (c) => {
    const keysParam = c.req.query('keys');

    try {
      // Build query based on whether specific keys are requested
      const keys = keysParam
        ? keysParam
            .split(',')
            .map((k) => k.trim())
            .filter(Boolean)
        : [];

      if (keysParam && keys.length === 0) {
        return json({ ok: true, data: { settings: {} } });
      }

      const results =
        keys.length > 0
          ? await db
              .select()
              .from(schema.settings)
              .where(or(...keys.map((k) => eq(schema.settings.key, k))))
          : await db.select().from(schema.settings);

      // Parse JSON values, falling back to raw string if invalid
      const settingsMap: Record<string, unknown> = {};
      for (const row of results) {
        try {
          settingsMap[row.key] = JSON.parse(row.value);
        } catch {
          settingsMap[row.key] = row.value;
        }
      }

      return json({ ok: true, data: { settings: settingsMap } });
    } catch (error) {
      console.error('[API] Error getting settings:', error);
      return json(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to get settings' } },
        500
      );
    }
  });

  // PUT /api/settings
  app.put('/', async (c) => {
    try {
      const body = await c.req.json();

      if (!body.settings || typeof body.settings !== 'object') {
        return json(
          {
            ok: false,
            error: { code: 'VALIDATION_ERROR', message: 'settings object is required' },
          },
          400
        );
      }

      const settingsToUpdate = body.settings as Record<string, unknown>;

      // Upsert each setting
      for (const [key, value] of Object.entries(settingsToUpdate)) {
        const jsonValue = JSON.stringify(value);
        await db
          .insert(schema.settings)
          .values({ key, value: jsonValue })
          .onConflictDoUpdate({
            target: schema.settings.key,
            set: { value: jsonValue, updatedAt: new Date().toISOString() },
          });
      }

      return json({ ok: true });
    } catch (error) {
      console.error('[API] Error updating settings:', error);
      return json(
        { ok: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update settings' } },
        500
      );
    }
  });

  return app;
}
