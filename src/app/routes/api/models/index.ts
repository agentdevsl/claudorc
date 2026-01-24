import { createFileRoute } from '@tanstack/react-router';
import { withErrorHandling } from '@/lib/api/middleware';
import { success } from '@/lib/api/response';
import {
  AVAILABLE_MODELS,
  DEFAULT_AGENT_MODEL,
  DEFAULT_ANTHROPIC_BASE_URL,
  DEFAULT_WORKFLOW_MODEL,
  getAnthropicBaseUrl,
} from '@/lib/constants/models';

/**
 * GET /api/models
 *
 * Returns the list of available AI models and default settings.
 */
export const Route = createFileRoute('/api/models/')({
  server: {
    handlers: {
      GET: withErrorHandling(async () => {
        return Response.json(
          success({
            models: AVAILABLE_MODELS,
            defaults: {
              agentModel: DEFAULT_AGENT_MODEL,
              workflowModel: DEFAULT_WORKFLOW_MODEL,
              apiBaseUrl: getAnthropicBaseUrl(),
              defaultApiBaseUrl: DEFAULT_ANTHROPIC_BASE_URL,
            },
          }),
          { status: 200 }
        );
      }),
    },
  },
});
