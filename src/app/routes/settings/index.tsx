import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { GitHubAppSetup } from '@/app/components/features/github-app-setup';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { ProjectSettings } from '@/app/components/features/project-settings';
import { ThemeToggle } from '@/app/components/features/theme-toggle';
import type { Project, ProjectConfig } from '@/db/schema/projects';

export const Route = createFileRoute('/settings/')({
  loader: async ({ context }) => {
    if (!context.services) {
      return { project: null as Project | null };
    }

    const projectsResult = await context.services.projectService.list({
      limit: 1,
    });
    return {
      project: projectsResult.ok ? (projectsResult.value[0] ?? null) : null,
    };
  },
  component: SettingsPage,
});

function SettingsPage(): React.JSX.Element {
  const { projectService } = Route.useRouteContext().services ?? {};
  const loaderData = Route.useLoaderData();
  const [project, setProject] = useState<Project | null>(loaderData.project ?? null);

  if (!project) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Settings' }]}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
          <EmptyState preset="no-projects" title="No project selected" />
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Settings' }]}
      projectName={project.name}
      projectPath={project.path}
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <ProjectSettings
          project={project}
          onSave={async (input: {
            maxConcurrentAgents?: number;
            config?: Partial<ProjectConfig>;
          }) => {
            if (!projectService) return;
            if (input.maxConcurrentAgents !== undefined) {
              await projectService.update(project.id, {
                maxConcurrentAgents: input.maxConcurrentAgents,
              });
            }
            if (input.config) {
              const updated = await projectService.updateConfig(project.id, input.config);
              if (updated.ok) {
                setProject(updated.value);
              }
            }
          }}
        />

        <GitHubAppSetup
          connected={Boolean(project.githubOwner && project.githubRepo)}
          repo={
            project.githubOwner && project.githubRepo
              ? `${project.githubOwner}/${project.githubRepo}`
              : undefined
          }
          onConnect={() => {}}
        />

        <section className="rounded-lg border border-border bg-surface p-6">
          <h2 className="text-lg font-semibold text-fg">Appearance</h2>
          <p className="text-sm text-fg-muted">Adjust the UI theme for your workspace.</p>
          <div className="mt-4">
            <ThemeToggle />
          </div>
        </section>
      </div>
    </LayoutShell>
  );
}
