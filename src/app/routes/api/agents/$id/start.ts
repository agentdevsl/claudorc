import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { AgentService } from '@/services/agent.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';
import { failure, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/middleware';
import { parseBody } from '@/lib/api/validation';
import { startAgentSchema } from '@/lib/api/schemas';

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

export const Route = createFileRoute('/api/agents/$id/start')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, startAgentSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        const result = await agentService.start(id, parsed.value.taskId);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
