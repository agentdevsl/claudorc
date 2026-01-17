import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { createTaskSchema, listTasksSchema } from '@/lib/api/schemas';
import { parseBody, parseQuery } from '@/lib/api/validation';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const taskService = new TaskService(db, worktreeService);

export const Route = createFileRoute('/api/tasks')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ request }) => {
        const parsed = parseQuery(new URL(request.url).searchParams, listTasksSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await taskService.list(parsed.value.projectId, {
          column: parsed.value.column,
          agentId: parsed.value.agentId,
          limit: parsed.value.limit,
          orderBy: 'position',
          orderDirection: 'asc',
        });

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        const counts = result.value.reduce(
          (acc, task) => {
            acc[task.column] += 1;
            return acc;
          },
          {
            backlog: 0,
            in_progress: 0,
            waiting_approval: 0,
            verified: 0,
          }
        );

        return Response.json(
          success({
            items: result.value,
            nextCursor: null,
            hasMore: false,
            counts,
          })
        );
      }),
      POST: withErrorHandling(async ({ request }) => {
        const parsed = await parseBody(request, createTaskSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await taskService.create(parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value), { status: 201 });
      }),
    },
  },
});
