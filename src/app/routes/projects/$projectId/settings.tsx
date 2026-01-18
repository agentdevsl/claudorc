import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/projects/$projectId/settings')({
  beforeLoad: ({ params }: { params: { projectId: string } }) => {
    // Redirect to global settings for now
    // TODO: Create project-specific settings page
    throw redirect({ to: '/settings/projects', search: { projectId: params.projectId } });
  },
});
