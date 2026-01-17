import { createFileRoute } from '@tanstack/react-router';
import { AgentSessionView } from '@/app/components/features/agent-session-view';
import { db } from '@/db/client';
import { AgentService } from '@/services/agent.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const taskService = new TaskService(db, worktreeService);

const sessionService = new SessionService(
  db,
  {
    createStream: async () => undefined,
    publish: async () => undefined,
    subscribe: async function* () {
      yield { type: 'chunk', data: {} };
    },
  },
  { baseUrl: process.env.APP_URL ?? 'http://localhost:5173' }
);

const agentService = new AgentService(db, worktreeService, taskService, sessionService);

export const Route = createFileRoute('/sessions/$sessionId')({
  loader: async ({ params }) => {
    const sessionResult = await sessionService.getById(params.sessionId);
    if (!sessionResult.ok) {
      throw new Error('Session not found');
    }

    return { session: sessionResult.value };
  },
  component: SessionPage,
});

function SessionPage(): React.JSX.Element {
  const { session } = Route.useLoaderData();
  const userId = 'current-user';

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
