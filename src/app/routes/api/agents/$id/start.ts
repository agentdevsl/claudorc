import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { startAgentSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
import { AgentService } from '@/services/agent.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const runtime = getApiRuntime();
if (!runtime.ok) {
  throw new Error(runtime.error.message);
}

const worktreeService = new WorktreeService(runtime.value.db, runtime.value.runner);
const taskService = new TaskService(runtime.value.db, worktreeService);
if (!runtime.value.streams) {
  throw new Error('Stream provider not configured');
}
const sessionService = new SessionService(runtime.value.db, runtime.value.streams, {
  baseUrl: process.env.APP_URL ?? 'http://localhost:5173',
});
const agentService = new AgentService(
  runtime.value.db,
  worktreeService,
  taskService,
  sessionService
);

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
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
