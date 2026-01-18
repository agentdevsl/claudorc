import { Funnel, Play, Robot } from '@phosphor-icons/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { Button } from '@/app/components/ui/button';
import type { Agent } from '@/db/schema/agents';
import type { Project } from '@/db/schema/projects';

export const Route = createFileRoute('/agents/')({
  loader: async ({ context }) => {
    if (!context.services) {
      return { agents: [] as Agent[], projects: [] as Project[] };
    }

    const agentsResult = await context.services.agentService.listAll();
    const projectsResult = await context.services.projectService.list({ limit: 10 });
    return {
      agents: agentsResult.ok ? agentsResult.value : [],
      projects: projectsResult.ok ? projectsResult.value : [],
    };
  },
  component: AgentsPage,
});

function AgentsPage(): React.JSX.Element {
  const navigate = useNavigate();
  const loaderData = Route.useLoaderData();
  const [agents] = useState<Agent[]>(loaderData.agents ?? []);
  const projects = loaderData.projects ?? [];

  const handleNewAgent = () => {
    if (projects.length > 0) {
      // Navigate to the first project's kanban where they can start an agent on a task
      navigate({ to: '/projects/$projectId', params: { projectId: projects[0].id } });
    } else {
      // Navigate to home to create a project first
      navigate({ to: '/' });
    }
  };

  return (
    <LayoutShell breadcrumbs={[{ label: 'Agents' }]}>
      <div
        data-testid="agents-page"
        className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10"
      >
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Workspace</p>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">Agents</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline">
              <Funnel className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={handleNewAgent}>
              <Play className="h-4 w-4" />
              New Agent
            </Button>
          </div>
        </header>

        <div data-testid="agents-list" className="grid gap-4 md:grid-cols-2">
          {agents.length === 0 ? (
            <div className="col-span-full">
              <EmptyState preset="no-agents" />
            </div>
          ) : (
            agents.map((agent) => (
              <Link
                key={agent.id}
                to="/agents/$agentId"
                params={{ agentId: agent.id }}
                data-testid="agent-card"
                className="rounded-lg border border-border bg-surface p-4 transition hover:border-fg-subtle"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-surface-subtle">
                    <Robot className="h-5 w-5 text-fg-muted" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-fg">{agent.name}</p>
                    <p className="text-xs text-fg-muted capitalize">{agent.type}</p>
                  </div>
                  <span data-testid="agent-status" className="text-xs text-fg-muted capitalize">
                    {agent.status}
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </LayoutShell>
  );
}
