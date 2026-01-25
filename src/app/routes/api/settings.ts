import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { getSettingsSchema, updateSettingsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';

const { settingsService } = getApiServicesOrThrow();

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      /**
       * GET /api/settings - Get all settings or specific keys
       *
       * Query params:
       *   - keys (optional): Comma-separated list of setting keys
       *
       * Returns: { settings: { [key: string]: unknown } }
       */
      GET: withErrorHandling(async ({ request }) => {
        const parsed = parseQuery(new URL(request.url).searchParams, getSettingsSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { keys } = parsed.value;

        const result = keys
          ? await settingsService.getMany(
              keys
                .split(',')
                .map((k) => k.trim())
                .filter(Boolean)
            )
          : await settingsService.getAll();

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ settings: result.value }));
      }),

      /**
       * PUT /api/settings - Update settings
       *
       * Body: { settings: { [key: string]: unknown } }
       *
       * Returns: { ok: true }
       */
      PUT: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, updateSettingsSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { settings } = parsed.value;

        const result = await settingsService.setMany(settings);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ ok: true }));
      }),
    },
  },
});
