import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { updateTaskSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';

const runtime = getApiRuntime();
if (!runtime.ok) {
  throw new Error(runtime.error.message);
}

const worktreeService = new WorktreeService(runtime.value.db, runtime.value.runner);
const taskService = new TaskService(runtime.value.db, worktreeService);

export const Route = createFileRoute('/api/tasks/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await taskService.getById(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      PATCH: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, updateTaskSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        const result = await taskService.update(id, parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      DELETE: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const result = await taskService.delete(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success({ deleted: true }));
      }),
    },
  },
});
