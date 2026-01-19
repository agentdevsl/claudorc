import { createFileRoute } from '@tanstack/react-router';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sqlite } from '@/db/client';
import * as schema from '@/db/schema/index.js';
import { withErrorHandling } from '@/lib/api/middleware';
import { createError } from '@/lib/errors/base';
import { GitHubTokenService } from '@/services/github-token.service';

function getGitHubService() {
  if (!sqlite) {
    throw new Error('Database not available');
  }
  const db = drizzle(sqlite, { schema });
  return new GitHubTokenService(db);
}

export const Route = createFileRoute('/api/github')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        if (action === 'repos') {
          const service = getGitHubService();
          const result = await service.listUserRepos();

          if (!result.ok) {
            const error = createError(result.error.code, result.error.message, 401);
            return Response.json(
              { ok: false, error: { code: error.code, message: error.message } },
              { status: 401 }
            );
          }

          return Response.json({ ok: true, data: { repos: result.value } });
        }

        if (action === 'token-info') {
          const service = getGitHubService();
          const result = await service.getTokenInfo();

          if (!result.ok) {
            const error = createError(result.error.code, result.error.message, 500);
            return Response.json(
              { ok: false, error: { code: error.code, message: error.message } },
              { status: 500 }
            );
          }

          return Response.json({ ok: true, data: { tokenInfo: result.value } });
        }

        return Response.json(
          { ok: false, error: { code: 'INVALID_ACTION', message: 'Invalid action parameter' } },
          { status: 400 }
        );
      }),
    },
  },
});
