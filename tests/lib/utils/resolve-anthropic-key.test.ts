import * as fs from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fs before importing module under test
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return {
    ...actual,
    promises: {
      readFile: vi.fn(),
    },
  };
});

import {
  readCredentialsFile,
  resolveAnthropicApiKey,
} from '../../../src/lib/utils/resolve-anthropic-key';

describe('readCredentialsFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns credentials when file exists with valid accessToken', async () => {
    const creds = { accessToken: 'sk-ant-test-key', refreshToken: 'rt-123' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const result = await readCredentialsFile();

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('sk-ant-test-key');
  });

  it('returns null when file does not exist', async () => {
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.promises.readFile).mockRejectedValue(error);

    const result = await readCredentialsFile();

    expect(result).toBeNull();
  });

  it('returns null when file contains malformed JSON', async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue('{ not valid json');

    const result = await readCredentialsFile();

    expect(result).toBeNull();
  });

  it('returns null when accessToken is missing', async () => {
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify({ refreshToken: 'rt' }));

    const result = await readCredentialsFile();

    expect(result).toBeNull();
  });

  it('returns null when credentials are expired', async () => {
    const creds = { accessToken: 'sk-ant-expired', expiresAt: Date.now() - 3600000 };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const result = await readCredentialsFile();

    expect(result).toBeNull();
  });

  it('returns credentials when expiresAt is in the future', async () => {
    const creds = { accessToken: 'sk-ant-valid', expiresAt: Date.now() + 3600000 };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const result = await readCredentialsFile();

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('sk-ant-valid');
  });

  it('returns credentials when expiresAt is not set', async () => {
    const creds = { accessToken: 'sk-ant-noexpiry' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const result = await readCredentialsFile();

    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('sk-ant-noexpiry');
  });

  it('returns null on permission denied', async () => {
    const error = new Error('EACCES') as NodeJS.ErrnoException;
    error.code = 'EACCES';
    vi.mocked(fs.promises.readFile).mockRejectedValue(error);

    const result = await readCredentialsFile();

    expect(result).toBeNull();
  });
});

describe('resolveAnthropicApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns database key when apiKeyService provides one', async () => {
    const mockService = {
      getDecryptedKey: vi.fn().mockResolvedValue('sk-db-key'),
    } as any;

    // No credentials file
    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.promises.readFile).mockRejectedValue(error);

    const key = await resolveAnthropicApiKey(mockService);

    expect(key).toBe('sk-db-key');
    expect(mockService.getDecryptedKey).toHaveBeenCalledWith('anthropic');
  });

  it('falls back to credentials file when database key is null', async () => {
    const mockService = {
      getDecryptedKey: vi.fn().mockResolvedValue(null),
    } as any;

    const creds = { accessToken: 'sk-ant-file-key' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const key = await resolveAnthropicApiKey(mockService);

    expect(key).toBe('sk-ant-file-key');
  });

  it('falls back to credentials file when apiKeyService throws', async () => {
    const mockService = {
      getDecryptedKey: vi.fn().mockRejectedValue(new Error('DB error')),
    } as any;

    const creds = { accessToken: 'sk-ant-fallback' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const key = await resolveAnthropicApiKey(mockService);

    expect(key).toBe('sk-ant-fallback');
  });

  it('returns credentials file key when no apiKeyService provided', async () => {
    const creds = { accessToken: 'sk-ant-only-source' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const key = await resolveAnthropicApiKey();

    expect(key).toBe('sk-ant-only-source');
  });

  it('returns null when no sources are available', async () => {
    const mockService = {
      getDecryptedKey: vi.fn().mockResolvedValue(null),
    } as any;

    const error = new Error('ENOENT') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    vi.mocked(fs.promises.readFile).mockRejectedValue(error);

    const key = await resolveAnthropicApiKey(mockService);

    expect(key).toBeNull();
  });

  it('prefers database key over credentials file', async () => {
    const mockService = {
      getDecryptedKey: vi.fn().mockResolvedValue('sk-db-preferred'),
    } as any;

    const creds = { accessToken: 'sk-ant-should-not-use' };
    vi.mocked(fs.promises.readFile).mockResolvedValue(JSON.stringify(creds));

    const key = await resolveAnthropicApiKey(mockService);

    expect(key).toBe('sk-db-preferred');
    // Should not even read the file since DB key was found
  });
});
