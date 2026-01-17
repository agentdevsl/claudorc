import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createAgentSchema, listAgentsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';
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

export const Route = createFileRoute('/api/agents')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const parsed = parseQuery(new URL(request.url).searchParams, listAgentsSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await agentService.list(parsed.value.projectId);
        if (!result.ok) {
          return Response.json(
            failure({
              code: 'INTERNAL_ERROR',
              message: 'Unexpected error',
              status: 500,
            }),
            { status: 500 }
          );
        }

        const filteredByStatus = parsed.value.status
          ? result.value.filter((agent) => agent.status === parsed.value.status)
          : result.value;

        const filtered = parsed.value.type
          ? filteredByStatus.filter((agent) => agent.type === parsed.value.type)
          : filteredByStatus;

        return Response.json(success(filtered));
      }),
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createAgentSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await agentService.create({
          projectId: parsed.value.projectId,
          name: parsed.value.name,
          type: parsed.value.type,
          config: parsed.value.config
            ? {
                allowedTools: parsed.value.config.allowedTools ?? [],
                maxTurns: parsed.value.config.maxTurns ?? 50,
                model: parsed.value.config.model,
                systemPrompt: parsed.value.config.systemPrompt,
                temperature: parsed.value.config.temperature,
              }
            : undefined,
        });
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
