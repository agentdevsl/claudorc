/**
 * Default Anthropic API base URL.
 * Can be overridden via ANTHROPIC_BASE_URL environment variable.
 */
export const DEFAULT_ANTHROPIC_BASE_URL = 'https://api.anthropic.com';

/**
 * Get the Anthropic API base URL from environment or localStorage.
 */
export function getAnthropicBaseUrl(): string {
  // Server-side: check environment variable
  if (typeof window === 'undefined') {
    return process.env.ANTHROPIC_BASE_URL ?? DEFAULT_ANTHROPIC_BASE_URL;
  }
  // Client-side: check localStorage
  return localStorage.getItem('anthropic_base_url') ?? DEFAULT_ANTHROPIC_BASE_URL;
}

/** @deprecated Use DEFAULT_ANTHROPIC_BASE_URL instead */
export const DEFAULT_API_ENDPOINT = DEFAULT_ANTHROPIC_BASE_URL;

/**
 * Available AI models for agent execution and AI features.
 */
export const AVAILABLE_MODELS = [
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    fullId: 'claude-sonnet-4-20250514',
    description: 'Balanced speed and capability',
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    fullId: 'claude-opus-4-20250514',
    description: 'Most capable for complex tasks',
  },
  {
    id: 'claude-haiku-4',
    name: 'Claude Haiku 4',
    fullId: 'claude-haiku-4-20250414',
    description: 'Fast and efficient',
  },
] as const;

/** Default model for agent execution */
export const DEFAULT_AGENT_MODEL = 'claude-sonnet-4';

/** Default model for workflow designer AI */
export const DEFAULT_WORKFLOW_MODEL = 'claude-haiku-4';

/** Model ID type from available models */
export type ModelId = (typeof AVAILABLE_MODELS)[number]['id'];

/** Full model ID type for API calls */
export type FullModelId = (typeof AVAILABLE_MODELS)[number]['fullId'];

/**
 * Get the full API model ID from a short model ID.
 */
export function getFullModelId(shortId: string): string {
  const model = AVAILABLE_MODELS.find((m) => m.id === shortId);
  return model?.fullId ?? shortId;
}

/**
 * Get a model by its short ID.
 */
export function getModelById(shortId: string) {
  return AVAILABLE_MODELS.find((m) => m.id === shortId);
}
