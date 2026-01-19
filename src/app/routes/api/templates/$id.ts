import { createFileRoute } from '@tanstack/react-router';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { updateTemplateSchema } from '@/lib/api/schemas';
import { parseBody } from '@/lib/api/validation';

export const Route = createFileRoute('/api/templates/$id')({
  server: {
    handlers: {
      GET: withErrorHandling(async ({ context }) => {
        const { templateService } = getApiServicesOrThrow();
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Template id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await templateService.getById(id);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      PATCH: withErrorHandling(async ({ request, context }) => {
        const { templateService } = getApiServicesOrThrow();
        const parsed = await parseBody(request, updateTemplateSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Template id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await templateService.update(id, parsed.value);
        if (!result.ok) {
          return Response.json(failure(result.error), {
            status: result.error.status,
          });
        }

        return Response.json(success(result.value));
      }),
      DELETE: withErrorHandling(async ({ context }) => {
        const { templateService } = getApiServicesOrThrow();
        const id = context.params?.id ?? '';
        if (!id) {
          return Response.json(
            failure({
              code: 'INVALID_ID',
              message: 'Template id is required',
              status: 400,
            }),
            { status: 400 }
          );
        }

        const result = await templateService.delete(id);
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
