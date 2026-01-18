import { createFileRoute } from '@tanstack/react-router';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { GitHubErrors } from '@/lib/errors/github-errors';

async function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string
): Promise<boolean> {
  if (!signature || !secret) {
    return false;
  }

  const [algorithm, hash] = signature.split('=');
  if (algorithm !== 'sha256' || !hash) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const computedHash = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return computedHash === hash;
}

export const Route = createFileRoute('/api/webhooks/github')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request }) => {
        const signature = request.headers.get('x-hub-signature-256');
        const event = request.headers.get('x-github-event');
        const deliveryId = request.headers.get('x-github-delivery');

        const payload = await request.text();
        const secret = process.env.GITHUB_WEBHOOK_SECRET ?? '';

        if (secret) {
          const isValid = await verifyWebhookSignature(payload, signature, secret);
          if (!isValid) {
            return Response.json(failure(GitHubErrors.WEBHOOK_INVALID), { status: 401 });
          }
        }

        let body: Record<string, unknown>;
        try {
          body = JSON.parse(payload) as Record<string, unknown>;
        } catch {
          return Response.json(
            failure({
              code: 'INVALID_JSON',
              message: 'Invalid JSON payload',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const action = body.action as string | undefined;

        // Handle different event types
        switch (event) {
          case 'installation': {
            // Installation created, deleted, or suspended
            console.log(`[GitHub Webhook] Installation ${action}: ${deliveryId}`);
            break;
          }

          case 'push': {
            // Code pushed - potentially sync config
            const repository = body.repository as
              | { owner: { login: string }; name: string }
              | undefined;
            if (repository) {
              console.log(
                `[GitHub Webhook] Push to ${repository.owner.login}/${repository.name}: ${deliveryId}`
              );
              // Find project by GitHub owner/repo and trigger sync
              // This is a background task, so we don't await it
            }
            break;
          }

          case 'ping': {
            // GitHub sends a ping event when the webhook is first set up
            console.log(`[GitHub Webhook] Ping received: ${deliveryId}`);
            break;
          }

          default: {
            console.log(`[GitHub Webhook] Unhandled event type: ${event}`);
          }
        }

        return Response.json(
          success({
            received: true,
            event,
            action,
            deliveryId,
          })
        );
      }),
    },
  },
});
