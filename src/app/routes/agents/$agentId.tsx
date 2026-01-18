import { Gear } from '@phosphor-icons/react';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { AgentConfigDialog } from '@/app/components/features/agent-config-dialog';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { Button } from '@/app/components/ui/button';
import type { RouterContext } from '@/app/router';
import { useServices } from '@/app/services/service-context';
import type { Agent, AgentConfig } from '@/db/schema/agents';

export const Route = createFileRoute('/agents/$agentId')({
  loader: async ({ context, params }: { context: RouterContext; params: { agentId: string } }) => {
    if (!context.services) {
      return { agent: null as Agent | null };
    }

    const result = await context.services.agentService.getById(params.agentId);
    return { agent: result.ok ? result.value : null };
  },
  component: AgentDetailPage,
});

function AgentDetailPage(): React.JSX.Element {
  const { agentService } = useServices();
  const { agentId } = Route.useParams();
  const loaderData = Route.useLoaderData() as { agent: Agent | null } | undefined;
  const [agent, setAgent] = useState<Agent | null>(loaderData?.agent ?? null);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    if (!agent) {
      const load = async () => {
        const result = await agentService.getById(agentId);
        if (result.ok) {
          setAgent(result.value);
        }
      };

      void load();
    }
  }, [agent, agentId, agentService]);

  if (!agent) {
    return <div className="p-6 text-sm text-fg-muted">Agent not found.</div>;
  }

  return (
    <LayoutShell breadcrumbs={[{ label: 'Agents', to: '/agents' }, { label: agent.name }]}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-fg-muted">Agent</p>
            <h1 className="text-2xl font-semibold tracking-tight text-fg">{agent.name}</h1>
            <p className="text-sm text-fg-muted capitalize">{agent.type}</p>
          </div>
          <Button variant="outline" onClick={() => setShowConfig(true)}>
            <Gear className="h-4 w-4" />
            Configure
          </Button>
        </header>

        <section className="rounded-lg border border-border bg-surface p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-fg">Status</p>
              <p className="text-xs text-fg-muted capitalize">{agent.status}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-fg">Current task</p>
              <p className="text-xs text-fg-muted">{agent.currentTaskId ?? 'None'}</p>
            </div>
          </div>
        </section>

        {showConfig && (
          <AgentConfigDialog
            agent={agent}
            open={showConfig}
            onOpenChange={setShowConfig}
            onSave={async (config: Partial<AgentConfig>) => {
              const result = await agentService.update(agent.id, config);
              if (result.ok) {
                setAgent(result.value);
              }
            }}
          />
        )}
      </div>
    </LayoutShell>
  );
}
