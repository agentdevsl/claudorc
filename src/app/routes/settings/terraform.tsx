import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/terraform')({
  beforeLoad: () => {
    throw redirect({ to: '/terraform/settings' });
  },
  component: () => null,
});
