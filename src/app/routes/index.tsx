import { FolderSimple, Gauge, Lightning } from "@phosphor-icons/react";
import { FolderSimple, Gauge, Lightning } from "@phosphor-icons/react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ProjectPicker } from "@/app/components/features/project-picker";
import { Button } from "@/app/components/ui/button";
import { db } from "@/db/client";
import { ProjectService } from "@/services/project.service";
import { WorktreeService } from "@/services/worktree.service";

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: "", stderr: "" }),
});

const projectService = new ProjectService(db, worktreeService, {
  exec: async () => ({ stdout: "", stderr: "" }),
});

export const Route = createFileRoute("/")({
  loader: async () => {
    const projects = await projectService.list({ limit: 6 });

    return {
      projects: projects.ok ? projects.value : [],
      runningAgents: 0,
    };
  },
  component: Dashboard,
});

function Dashboard(): React.JSX.Element {
  const { projects, runningAgents } = Route.useLoaderData();

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-fg-muted">
            AgentPane
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            Dashboard
          </h1>
          <p className="text-sm text-fg-muted">
            Keep projects, agents, and sessions flowing with local-first
            control.
          </p>
        </div>
        <Button>New Project</Button>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-fg-muted">
            <FolderSimple className="h-4 w-4" />
            <span className="text-sm">Projects</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-fg tabular-nums">
            {projects.length}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-fg-muted">
            <Gauge className="h-4 w-4" />
            <span className="text-sm">Running agents</span>
          </div>
          <p className="mt-3 text-2xl font-semibold text-fg tabular-nums">
            {runningAgents}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-4">
          <div className="flex items-center gap-2 text-fg-muted">
            <Lightning className="h-4 w-4" />
            <span className="text-sm">Recent activity</span>
          </div>
          <p className="mt-3 text-sm text-fg-muted">
            Review the latest sessions and approvals.
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-border bg-surface p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-fg">Recent projects</h2>
            <p className="text-sm text-fg-muted">
              Jump back into active workspaces.
            </p>
          </div>
          <ProjectPicker
            projects={projects}
            selectedProject={projects[0] ?? null}
            onSelect={() => {}}
            onNewProject={() => {}}
          />
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {projects.map((project: Project) => (
            <Link
              key={project.id}
              to="/projects/$projectId"
              params={{ projectId: project.id }}
              className="rounded-lg border border-border bg-surface-subtle p-4 transition hover:border-fg-subtle"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-fg">
                    {project.name}
                  </h3>
                  <p className="text-xs text-fg-muted truncate">
                    {project.path}
                  </p>
                </div>
                <span className="text-xs text-fg-muted">View</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
