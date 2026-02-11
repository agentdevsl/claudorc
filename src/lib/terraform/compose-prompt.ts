export type { ModuleMatch } from './types.js';

import type { SettingsService } from '../../services/settings.service.js';
import { getPromptDefaultText, resolvePromptServer } from '../prompts/index.js';
import { TERRAFORM_COMPOSE_STACKS_TEXT } from './stacks-prompt.js';
import type { ComposeMode } from './types.js';

/**
 * Build the Terraform composition system prompt.
 *
 * When mode is 'stacks', uses the Stacks-specific prompt with injected skill reference.
 * The caller must provide `stacksReference` content (loaded server-side).
 * When mode is 'terraform' (default), uses the standard Terraform compose prompt.
 */
export async function buildCompositionSystemPrompt(
  moduleContext: string,
  settingsService?: SettingsService,
  mode: ComposeMode = 'terraform',
  stacksReference?: string
): Promise<string> {
  if (mode === 'stacks') {
    const ref = stacksReference ?? '';
    if (settingsService) {
      return resolvePromptServer('terraform-compose-stacks', settingsService, {
        moduleContext,
        stacksReference: ref,
      });
    }
    return TERRAFORM_COMPOSE_STACKS_TEXT.replaceAll('{{moduleContext}}', moduleContext).replaceAll(
      '{{stacksReference}}',
      ref
    );
  }

  if (settingsService) {
    return resolvePromptServer('terraform-compose', settingsService, { moduleContext });
  }
  // Fallback: use default with manual substitution
  return getPromptDefaultText('terraform-compose').replaceAll('{{moduleContext}}', moduleContext);
}
