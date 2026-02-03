/**
 * Prompt resolution service
 *
 * Resolves prompt text by checking for user overrides in settings,
 * falling back to defaults, and substituting dynamic variables.
 */

import type { SettingsService } from '../../services/settings.service.js';
import { PROMPT_REGISTRY } from './prompt-registry.js';

/**
 * Resolve a prompt for server-side use.
 *
 * 1. Look up default text from PROMPT_REGISTRY
 * 2. Check settings for an override (key: `prompt.{promptId}`)
 * 3. If non-empty override exists, use it; otherwise use default
 * 4. Replace {{variable}} placeholders with provided values
 */
export async function resolvePromptServer(
  promptId: string,
  settingsService: SettingsService,
  variables?: Record<string, string>
): Promise<string> {
  const definition = PROMPT_REGISTRY[promptId];
  if (!definition) {
    throw new Error(`Unknown prompt ID: ${promptId}`);
  }

  let text = definition.defaultText;

  // Check for user override in settings
  const override = await settingsService.getValue<string>(definition.settingsKey, '');
  if (override && override.trim().length > 0) {
    text = override;
  }

  // Substitute dynamic variables
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      text = text.replaceAll(`{{${key}}}`, value);
    }
  }

  return text;
}
