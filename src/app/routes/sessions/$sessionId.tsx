import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AgentSessionView } from "@/app/components/features/agent-session-view";
import { useServices } from "@/app/services/service-context";
import type { SessionWithPresence } from "@/services/session.service";

export const Route = createFileRoute("/sessions/$sessionId")({
  loader: async () => ({ session: null as SessionWithPresence | null }),
  component: SessionPage,
});

function SessionPage(): React.JSX.Element {
  const loaderData = Route.useLoaderData();
  const { sessionService, agentService } = useServices();
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<SessionWithPresence | null>(loaderData.session ?? null);
  const userId = 'current-user';

  useEffect(() => {
    const load = async () => {
      const result = await sessionService.getById(sessionId);
      if (result.ok) {
        setSession(result.value);
      }
    };

    void load();
  }, [sessionId, sessionService]);

  if (!session) {
    return <div className="p-6 text-sm text-fg-muted">Session not found.</div>;
  }

  return (
    <div className="h-screen bg-canvas">
      <AgentSessionView
        sessionId={session.id}
        agentId={session.agentId ?? ''}
        userId={userId}
        onPause={async () => {
          if (session.agentId) {
            await agentService.pause(session.agentId);
          }
        }}
        onResume={async () => {
          if (session.agentId) {
            await agentService.resume(session.agentId);
          }
        }}
        onStop={async () => {
          if (session.agentId) {
            await agentService.stop(session.agentId);
          }
        }}
      />
    </div>
  );
}

        }}
        onResume={async () => {
          if (session.agentId) {
            await agentService.resume(session.agentId);
          }
        }}
        onStop={async () => {
          if (session.agentId) {
            await agentService.stop(session.agentId);
          }
        }}
      />
    </div>
  );
}
