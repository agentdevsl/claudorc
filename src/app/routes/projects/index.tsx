import { Plus } from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { NewProjectDialog } from '@/app/components/features/new-project-dialog';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Project } from '@/db/schema/projects';
import type { Result } from '@/lib/utils/result';
import type { PathValidation } from '@/services/project.service';

export const Route = createFileRoute('/projects/')({
  loader: async ({ context }) => {
    if (!context.services) {
      return { projects: [] };
    }

    const projectsResult = await context.services.projectService.list({
      limit: 24,
    });
    return { projects: projectsResult.ok ? projectsResult.value : [] };
  },
  component: ProjectsPage,
});

function ProjectsPage(): React.JSX.Element {
  const { projectService } = useServices();
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();
  const [projects, setProjects] = useState<Project[]>(loaderData.projects ?? []);
  const [showNewProject, setShowNewProject] = useState(false);

  const handleCreateProject = async (data: {
    name: string;
    path: string;
    description?: string;
  }): Promise<void> => {
    const result = await projectService.create({
      name: data.name,
      path: data.path,
      description: data.description,
    });

    if (result.ok) {
      setProjects((prev) => [result.value, ...prev]);
    }
  };

  const handleValidatePath = async (path: string): Promise<Result<PathValidation, unknown>> => {
    return projectService.validatePath(path);
  };

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Projects' }]}
      actions={
        <Button onClick={() => setShowNewProject(true)}>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      }
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
        <div className="grid gap-4 md:grid-cols-2">
          {projects.length === 0 ? (
            <div className="col-span-full">
              <EmptyState
                preset="no-projects"
                action={{
                  label: 'Create project',
                  onClick: () => setShowNewProject(true),
                }}
              />
            </div>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                className="rounded-lg border border-border bg-surface p-4 text-left transition hover:border-fg-subtle"
                onClick={() =>
                  navigate({
                    to: '/projects/$projectId',
                    params: { projectId: project.id },
                  })
                }
              >
                <p className="text-sm font-semibold text-fg">{project.name}</p>
                <p className="text-xs text-fg-muted truncate">{project.path}</p>
              </button>
            ))
          )}
        </div>
      </div>

      <NewProjectDialog
        open={showNewProject}
        onOpenChange={setShowNewProject}
        onSubmit={handleCreateProject}
        onValidatePath={handleValidatePath}
      />
    </LayoutShell>
  );
}
