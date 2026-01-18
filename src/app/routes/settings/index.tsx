import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    // Redirect to API keys setup first (Anthropic key is required to run agents)
    throw redirect({ to: '/settings/api-keys' });
  },
});
