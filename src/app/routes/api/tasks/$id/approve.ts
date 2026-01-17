import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { TaskService } from '@/services/task.service';
import { WorktreeService } from '@/services/worktree.service';
import { failure, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/middleware';
import { parseBody } from '@/lib/api/validation';
import { approveTaskSchema } from '@/lib/api/schemas';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const taskService = new TaskService(db, worktreeService);

export const Route = createFileRoute('/api/tasks/$id/approve')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, approveTaskSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        const result = await taskService.approve(id, parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
    },
  },
});
