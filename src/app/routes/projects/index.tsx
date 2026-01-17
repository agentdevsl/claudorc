import { FolderSimple, Plus } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Project } from '@/db/schema/projects';

export const Route = createFileRoute('/projects/')({
  loader: async () => ({ projects: [] }),
  component: ProjectsPage,
});

function ProjectsPage(): React.JSX.Element {
  const loaderData = Route.useLoaderData();
  const { projectService } = useServices();
  const [projects, setProjects] = useState<Project[]>(loaderData.projects ?? []);

  useEffect(() => {
    const load = async () => {
      const result = await projectService.list({ limit: 24 });
      if (result.ok) {
        setProjects(result.value);
      }
    };

    void load();
  }, [projectService]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Workspace</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Projects</h1>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <Link
            key={project.id}
            to="/projects/$projectId"
            params={{ projectId: project.id }}
            className="rounded-lg border border-border bg-surface p-4 transition hover:border-fg-subtle"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-subtle">
                <FolderSimple className="h-5 w-5 text-fg-muted" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold text-fg">{project.name}</p>
                <p className="text-xs text-fg-muted truncate">{project.path}</p>
              </div>
              <span className="text-xs text-fg-muted">Open</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
