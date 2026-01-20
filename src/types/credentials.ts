/**
 * OAuth credentials structure (from ~/.claude/.credentials.json)
 *
 * Note: These credentials may be used either as:
 * 1. OAuth tokens for Claude Code authentication flows
 * 2. API keys for direct Anthropic SDK usage (accessToken as apiKey)
 *
 * The accessToken field can function as an Anthropic API key when using
 * the Claude credentials file format.
 */
export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  scope?: string;
}
