import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/agents')({
  beforeLoad: () => {
    // Redirect to main agents page
    throw redirect({ to: '/agents' });
  },
});
