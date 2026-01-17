const BLOCKED_PATTERNS = [/SECRET/i, /PASSWORD/i, /PRIVATE_KEY/i, /_TOKEN$/i, /_API_KEY$/i];

const ALLOWED_KEYS = ['ANTHROPIC_API_KEY', 'GITHUB_TOKEN'];

export const containsSecrets = (config: Record<string, unknown>): string[] => {
  const violations: string[] = [];

  for (const key of Object.keys(config)) {
    if (ALLOWED_KEYS.includes(key)) {
      continue;
    }

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(key)) {
        violations.push(key);
        break;
      }
    }
  }

  return violations;
};
