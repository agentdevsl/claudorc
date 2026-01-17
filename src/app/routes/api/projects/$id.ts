import { createFileRoute } from '@tanstack/react-router';
import { getApiRuntime } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { updateProjectSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';
import { ProjectService } from '@/services/project.service';
import { WorktreeService } from '@/services/worktree.service';

const runtime = getApiRuntime();
if (!runtime.ok) {
  throw new Error(runtime.error.message);
}

const worktreeService = new WorktreeService(runtime.value.db, runtime.value.runner);

const projectService = new ProjectService(runtime.value.db, worktreeService, runtime.value.runner);

export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Project id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await projectService.getById(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      PATCH: withErrorHandling(async ({ request, context }) => {
        const parsed = await parseBody(request, updateProjectSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Project id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await projectService.update(id, parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      DELETE: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Project id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await projectService.delete(id);
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
