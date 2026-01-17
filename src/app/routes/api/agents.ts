import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createAgentSchema, listAgentsSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';
import { AgentService } from '@/services/agent.service';
import { SessionService } from '@/services/session.service';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

// TODO: Phase 2 - Replace stub implementations with real services via dependency injection.
// These stubs allow API routes to be tested without actual git/stream operations.
// See: /specs/application/architecture/app-bootstrap.md for DI setup requirements.
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
          return Response.json(failure(result.error), { status: result.error.status });
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

        const result = await agentService.create(parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
