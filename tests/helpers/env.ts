import { vi } from 'vitest';

export const TEST_ENV = {
  ANTHROPIC_API_KEY: 'test-api-key-sk-ant-12345',
  GITHUB_APP_ID: '123456',
  GITHUB_APP_PRIVATE_KEY: 'test-private-key',
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_WEBHOOK_SECRET: 'test-webhook-secret',
  SESSION_SECRET: 'test-session-secret-32-chars-long!',
  BASE_URL: 'http://localhost:3000',
  PGLITE_DATA_DIR: '',
  NODE_ENV: 'test',
} as const;

export function setupTestEnv(): void {
  for (const [key, value] of Object.entries(TEST_ENV)) {
    vi.stubEnv(key, value);
  }
}

export function resetTestEnv(): void {
  vi.unstubAllEnvs();
}

export function withTestEnv<T>(overrides: Partial<typeof TEST_ENV>, fn: () => T): T {
  const originalEnv = { ...process.env };

  try {
    setupTestEnv();
    for (const [key, value] of Object.entries(overrides)) {
      vi.stubEnv(key, value);
    }
    return fn();
  } finally {
    vi.unstubAllEnvs();
    Object.assign(process.env, originalEnv);
  }
}

export function mockEnvVar(key: string, value: string): () => void {
  const original = process.env[key];
  vi.stubEnv(key, value);

  return () => {
    if (original === undefined) {
      delete process.env[key];
    } else {
      vi.stubEnv(key, original);
    }
  };
}
