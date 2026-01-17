import { createFileRoute } from '@tanstack/react-router';
import { db } from '@/db/client';
import { ProjectService } from '@/services/project.service';
import { WorktreeService } from '@/services/worktree.service';
import { failure, success } from '@/lib/api/response';
import { withErrorHandling } from '@/lib/api/middleware';
import { parseBody } from '@/lib/api/validation';
import { updateProjectSchema } from '@/lib/api/schemas';
import { ValidationErrors } from '@/lib/errors/validation-errors';

const worktreeService = new WorktreeService(db, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const service = new ProjectService(db, worktreeService, {
  exec: async () => ({ stdout: '', stderr: '' }),
});

const validateId = (id: string) =>
  id.length > 0 ? null : ValidationErrors.INVALID_ID('projectId');

export const Route = createFileRoute('/api/projects/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const invalid = validateId(id);
        if (invalid) {
          return Response.json(failure(invalid), { status: 400 });
        }

        const result = await service.getById(id);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
      PATCH: withErrorHandling(async ({ request, context }) => {
        const id = context.params?.id ?? '';
        const invalid = validateId(id);
        if (invalid) {
          return Response.json(failure(invalid), { status: 400 });
        }

        const parsed = await parseBody(request, updateProjectSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const result = await service.update(id, {
          maxConcurrentAgents: parsed.value.maxConcurrentAgents,
        });

        if (parsed.value.config) {
          const configResult = await service.updateConfig(id, parsed.value.config);
          if (!configResult.ok) {
            return Response.json(failure(configResult.error), {
              status: configResult.error.status,
            });
          }
          return Response.json(success(configResult.value));
        }

        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success(result.value));
      }),
      DELETE: withErrorHandling(async ({ context }) => {
        const id = context.params?.id ?? '';
        const invalid = validateId(id);
        if (invalid) {
          return Response.json(failure(invalid), { status: 400 });
        }

        const result = await service.delete(id);
        if (!result.ok) {
          return Response.json(failure(result.error), { status: result.error.status });
        }

        return Response.json(success({ deleted: true }));
      }),
    },
  },
});
