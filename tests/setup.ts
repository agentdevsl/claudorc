import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { clearTestDatabase, closeTestDatabase, setupTestDatabase } from './helpers/database';

vi.stubEnv('ANTHROPIC_API_KEY', 'test-api-key');
vi.stubEnv('NODE_ENV', 'test');

beforeAll(async () => {
  await setupTestDatabase();
});

afterEach(async () => {
  await clearTestDatabase();
  vi.clearAllMocks();
});

afterAll(async () => {
  await closeTestDatabase();
});
