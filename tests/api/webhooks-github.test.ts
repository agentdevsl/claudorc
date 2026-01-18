import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/task.service', () => ({ TaskService: class {} }));
vi.mock('@/services/worktree.service', () => ({ WorktreeService: class {} }));
vi.mock('@/services/session.service', () => ({ SessionService: class {} }));
vi.mock('@/services/agent.service', () => ({ AgentService: class {} }));
vi.mock('@/services/project.service', () => ({ ProjectService: class {} }));
vi.mock('@/db/client', () => ({ pglite: {}, sqlite: {}, db: {} }));

import { Route as GitHubWebhookRoute } from '@/app/routes/api/webhooks/github';

const parseJson = async <T>(response: Response): Promise<T> => {
  return (await response.json()) as T;
};

describe('GitHub Webhook API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear env var for tests that don't need signature verification
    delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  describe('POST /api/webhooks/github', () => {
    it('handles ping event', async () => {
      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'ping',
            'x-github-delivery': 'delivery-123',
          },
          body: JSON.stringify({
            zen: 'Design for failure.',
            hook_id: 123456,
          }),
        }),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{
        ok: true;
        data: { received: boolean; event: string; deliveryId: string };
      }>(response as Response);
      expect(data.data.received).toBe(true);
      expect(data.data.event).toBe('ping');
      expect(data.data.deliveryId).toBe('delivery-123');
    });

    it('handles installation event', async () => {
      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'installation',
            'x-github-delivery': 'delivery-456',
          },
          body: JSON.stringify({
            action: 'created',
            installation: {
              id: 12345,
              account: {
                login: 'test-org',
                type: 'Organization',
              },
            },
          }),
        }),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{
        ok: true;
        data: { received: boolean; event: string; action: string };
      }>(response as Response);
      expect(data.data.received).toBe(true);
      expect(data.data.event).toBe('installation');
      expect(data.data.action).toBe('created');
    });

    it('handles push event', async () => {
      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'push',
            'x-github-delivery': 'delivery-789',
          },
          body: JSON.stringify({
            ref: 'refs/heads/main',
            repository: {
              owner: { login: 'test-org' },
              name: 'test-repo',
            },
            commits: [{ message: 'Update config' }],
          }),
        }),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{
        ok: true;
        data: { received: boolean; event: string };
      }>(response as Response);
      expect(data.data.received).toBe(true);
      expect(data.data.event).toBe('push');
    });

    it('handles unknown event gracefully', async () => {
      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'unknown_event',
            'x-github-delivery': 'delivery-abc',
          },
          body: JSON.stringify({ action: 'test' }),
        }),
        params: {},
      });

      expect(response?.status).toBe(200);
      const data = await parseJson<{
        ok: true;
        data: { received: boolean; event: string };
      }>(response as Response);
      expect(data.data.received).toBe(true);
      expect(data.data.event).toBe('unknown_event');
    });

    it('rejects invalid JSON payload', async () => {
      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'push',
            'x-github-delivery': 'delivery-bad',
          },
          body: 'not valid json',
        }),
        params: {},
      });

      expect(response?.status).toBe(400);
      const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
      expect(data.error.code).toBe('INVALID_JSON');
    });

    it('rejects invalid signature when secret is configured', async () => {
      process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';

      const response = await GitHubWebhookRoute.options.server?.handlers?.POST({
        request: new Request('http://localhost/api/webhooks/github', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-github-event': 'push',
            'x-github-delivery': 'delivery-sig',
            'x-hub-signature-256': 'sha256=invalid-signature',
          },
          body: JSON.stringify({ action: 'test' }),
        }),
        params: {},
      });

      expect(response?.status).toBe(401);
      const data = await parseJson<{ ok: false; error: { code: string } }>(response as Response);
      expect(data.error.code).toBe('GITHUB_WEBHOOK_INVALID');
    });
  });
});
