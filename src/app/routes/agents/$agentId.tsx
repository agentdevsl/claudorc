import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Gear } from "@phosphor-icons/react";
import { db } from "@/db/client";
import type { AgentConfig } from "@/db/schema/agents";
import { AgentConfigDialog } from "@/app/components/features/agent-config-dialog";
import { Button } from "@/app/components/ui/button";
import { AgentService } from "@/services/agent.service";
import { TaskService } from "@/services/task.service";
import { WorktreeService } from "@/services/worktree.service";
import { SessionService } from "@/services/session.service";

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: "", stderr: "" }),
});

const taskService = new TaskService(db, worktreeService);

const sessionService = new SessionService(
  db,
  {
    createStream: async () => undefined,
    publish: async () => undefined,
    subscribe: async function* () {
      yield { type: "chunk", data: {} };
    },
  },
  { baseUrl: process.env.APP_URL ?? "http://localhost:5173" },
);

const agentService = new AgentService(
  db,
  worktreeService,
  taskService,
  sessionService,
);

export const Route = createFileRoute("/agents/$agentId")({
  loader: async ({ params }) => {
    const agentResult = await agentService.getById(params.agentId);
    if (!agentResult.ok) {
      throw new Error("Agent not found");
    }

    return { agent: agentResult.value };
  },
  component: AgentDetailPage,
});

function AgentDetailPage(): React.JSX.Element {
  const { agent } = Route.useLoaderData();
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-fg-muted">Agent</p>
          <h1 className="text-2xl font-semibold tracking-tight text-fg">
            {agent.name}
          </h1>
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
            <p className="text-xs text-fg-muted">{agent.status}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-fg">Current task</p>
            <p className="text-xs text-fg-muted">
              {agent.currentTaskId ?? "None"}
            </p>
          </div>
        </div>
      </section>

      {showConfig && (
        <AgentConfigDialog
          agent={agent}
          open={showConfig}
          onOpenChange={setShowConfig}
          onSave={async (config: Partial<AgentConfig>) => {
            await agentService.update(agent.id, config);
          }}
        />
      )}
    </div>
  );
}
