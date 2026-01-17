import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
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

export const Route = createFileRoute('/api/agents/$id/stop')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await agentService.stop(id);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ stopped: true }));
      }),
    },
  },
});
