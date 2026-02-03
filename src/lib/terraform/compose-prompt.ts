export type { ModuleMatch } from './types.js';

import type { SettingsService } from '../../services/settings.service.js';
import { getPromptDefaultText, resolvePromptServer } from '../prompts/index.js';

/**
 * Build the Terraform composition system prompt.
 *
 * When a settingsService is provided, any user override stored at
 * `prompt.terraform-compose` is used instead of the default text.
 * The `{{moduleContext}}` placeholder is always substituted.
 */
export async function buildCompositionSystemPrompt(
  moduleContext: string,
  settingsService?: SettingsService
): Promise<string> {
  if (settingsService) {
    return resolvePromptServer('terraform-compose', settingsService, { moduleContext });
  }
  // Fallback: use default with manual substitution
  return getPromptDefaultText('terraform-compose').replaceAll('{{moduleContext}}', moduleContext);
}
