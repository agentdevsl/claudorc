import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/projects')({
  beforeLoad: () => {
    // Redirect to main projects page
    throw redirect({ to: '/projects' });
  },
});
