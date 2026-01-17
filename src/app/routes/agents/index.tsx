import { Funnel, Play, Robot } from '@phosphor-icons/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/app/components/ui/button';
import { useServices } from '@/app/services/service-context';
import type { Agent } from '@/db/schema/agents';

export const Route = createFileRoute('/agents/')({
  loader: async () => ({ agents: [] as Agent[] }),
  component: AgentsPage,
});

function AgentsPage(): React.JSX.Element {
  const loaderData = Route.useLoaderData();
  const { agentService } = useServices();
  const [agents, setAgents] = useState<Agent[]>(loaderData.agents ?? []);

  useEffect(() => {
    const load = async () => {
      const result = await agentService.list('00000000-0000-0000-0000-000000000000');
      if (result.ok) {
        setAgents(result.value);
      }
    };

    void load();
  }, [agentService]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
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
          <Button>
            <Play className="h-4 w-4" />
            New Agent
          </Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => (
          <Link
            key={agent.id}
            to="/agents/$agentId"
            params={{ agentId: agent.id }}
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
              <span className="text-xs text-fg-muted capitalize">{agent.status}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
