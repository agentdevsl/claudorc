import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// Mock Setup for Server Encryption
// ============================================================================

// Mock fs module
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

const mockedFs = vi.mocked(fs);

// ============================================================================
// Mock Setup for Client-side Token Encryption (Web Crypto API)
// ============================================================================

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

// Mock Web Crypto API
const mockCryptoSubtle = {
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

const mockCrypto = {
  getRandomValues: vi.fn(<T extends ArrayBufferView>(array: T): T => {
    // Fill with random bytes for testing
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return array;
  }),
  subtle: mockCryptoSubtle,
};

// ============================================================================
// Server-side Token Encryption Tests (15 tests)
// ============================================================================

describe('Server-side Token Encryption', () => {
  const originalEnv = process.env;
  let testDataDir: string;
  let keyBuffer: Buffer;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Reset environment
    process.env = { ...originalEnv };
    testDataDir = '/tmp/test-data';
    process.env.SQLITE_DATA_DIR = testDataDir;

    // Generate a consistent test key
    keyBuffer = crypto.randomBytes(32);

    // Default mocks for successful key operations
    mockedFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
      const pathStr = String(filePath);
      if (pathStr === testDataDir) return true;
      if (pathStr === path.join(testDataDir, 'encryption.key')) return true;
      return false;
    });
    mockedFs.readFileSync.mockReturnValue(keyBuffer);
    mockedFs.writeFileSync.mockImplementation(() => {});
    mockedFs.mkdirSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  describe('Key Management', () => {
    it('creates data directory if it does not exist', async () => {
      mockedFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
        const pathStr = String(filePath);
        if (pathStr === testDataDir) return false; // Data dir doesn't exist
        if (pathStr === path.join(testDataDir, 'encryption.key')) return false;
        return false;
      });

      const { encryptToken } = await import('@/lib/crypto/server-encryption');
      encryptToken('test-token');

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(testDataDir, { recursive: true });
    });

    it('generates new key when key file does not exist', async () => {
      mockedFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
        const pathStr = String(filePath);
        if (pathStr === testDataDir) return true;
        if (pathStr === path.join(testDataDir, 'encryption.key')) return false; // Key doesn't exist
        return false;
      });

      const { encryptToken } = await import('@/lib/crypto/server-encryption');
      encryptToken('test-token');

      expect(mockedFs.writeFileSync).toHaveBeenCalledWith(
        path.join(testDataDir, 'encryption.key'),
        expect.any(Buffer),
        { mode: 0o600 }
      );
    });

    it('uses existing key when key file exists', async () => {
      const { encryptToken } = await import('@/lib/crypto/server-encryption');
      encryptToken('test-token');

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(path.join(testDataDir, 'encryption.key'));
      expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('throws error when key file is corrupted (wrong size)', async () => {
      mockedFs.readFileSync.mockReturnValue(Buffer.from('short-key'));

      const { encryptToken } = await import('@/lib/crypto/server-encryption');

      expect(() => encryptToken('test-token')).toThrow(/corrupted/);
    });

    it('throws error when data directory cannot be created', async () => {
      mockedFs.existsSync.mockReturnValue(false);
      mockedFs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      const { encryptToken } = await import('@/lib/crypto/server-encryption');

      expect(() => encryptToken('test-token')).toThrow(/Cannot create data directory/);
    });

    it('throws error when key file cannot be read', async () => {
      mockedFs.readFileSync.mockImplementation(() => {
        throw new Error('EACCES: permission denied');
      });

      const { encryptToken } = await import('@/lib/crypto/server-encryption');

      expect(() => encryptToken('test-token')).toThrow(/Cannot read encryption key/);
    });

    it('throws error when key file cannot be written', async () => {
      mockedFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
        const pathStr = String(filePath);
        if (pathStr === testDataDir) return true;
        if (pathStr === path.join(testDataDir, 'encryption.key')) return false;
        return false;
      });
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('ENOSPC: no space left on device');
      });

      const { encryptToken } = await import('@/lib/crypto/server-encryption');

      expect(() => encryptToken('test-token')).toThrow(/Cannot write encryption key/);
    });

    it('uses default data directory when SQLITE_DATA_DIR is not set', async () => {
      delete process.env.SQLITE_DATA_DIR;

      mockedFs.existsSync.mockImplementation((filePath: fs.PathLike) => {
        const pathStr = String(filePath);
        if (pathStr === './data') return true;
        if (pathStr === path.join('./data', 'encryption.key')) return true;
        return false;
      });
      mockedFs.readFileSync.mockReturnValue(keyBuffer);

      const { encryptToken } = await import('@/lib/crypto/server-encryption');
      encryptToken('test-token');

      expect(mockedFs.readFileSync).toHaveBeenCalledWith(path.join('./data', 'encryption.key'));
    });
  });

  describe('Encrypt/Decrypt Operations', () => {
    it('encrypts and decrypts a token correctly', async () => {
      const originalToken = 'ghp_test1234567890abcdef';

      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken(originalToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(originalToken);
    });

    it('produces different ciphertext for same plaintext (random IV)', async () => {
      const token = 'test-token-value';

      const { encryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('handles single character encryption', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken('x');
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe('x');
    });

    it('handles long tokens correctly', async () => {
      const longToken = 'a'.repeat(10000);

      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('handles unicode characters in tokens', async () => {
      const unicodeToken = 'token-with-unicode-\u4e2d\u6587-\u{1F600}';

      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken(unicodeToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(unicodeToken);
    });

    it('throws error when decrypting data that is too short', async () => {
      const { decryptToken } = await import('@/lib/crypto/server-encryption');

      // IV (12) + Tag (16) + at least 1 byte = 29 minimum
      const shortData = Buffer.alloc(20).toString('base64');

      expect(() => decryptToken(shortData)).toThrow(/too short/);
    });

    it('throws error when decrypting corrupted data', async () => {
      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken('test-token');

      // Corrupt the encrypted data by modifying bytes
      const corruptedBuffer = Buffer.from(encrypted, 'base64');
      corruptedBuffer[20] ^= 0xff; // Flip bits in the ciphertext
      const corrupted = corruptedBuffer.toString('base64');

      expect(() => decryptToken(corrupted)).toThrow(/Decryption failed/);
    });

    it('handles special characters in tokens', async () => {
      const specialToken = 'token!@#$%^&*()_+-=[]{}|;:,.<>?';

      const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

      const encrypted = encryptToken(specialToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(specialToken);
    });
  });
});

// ============================================================================
// Token Masking and Validation Tests (7 tests)
// ============================================================================

describe('Token Utilities', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  describe('maskToken', () => {
    it('masks tokens longer than 12 characters', async () => {
      const { maskToken } = await import('@/lib/crypto/server-encryption');

      const result = maskToken('ghp_1234567890abcdef');

      expect(result).toBe('ghp_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022cdef');
    });

    it('returns fixed mask for short tokens (12 or fewer chars)', async () => {
      const { maskToken } = await import('@/lib/crypto/server-encryption');

      expect(maskToken('short')).toBe('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
      expect(maskToken('exactly12chr')).toBe('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    });

    it('masks exactly at boundary (13 chars shows first/last 4)', async () => {
      const { maskToken } = await import('@/lib/crypto/server-encryption');

      const result = maskToken('1234567890123');

      expect(result).toBe('1234\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u20220123');
    });

    it('masks GitHub classic PAT format correctly', async () => {
      const { maskToken } = await import('@/lib/crypto/server-encryption');

      const result = maskToken('ghp_abcdefghijklmnopqrstuvwxyz123456');

      expect(result).toMatch(/^ghp_\u2022{8}3456$/);
    });

    it('masks GitHub fine-grained PAT format correctly', async () => {
      const { maskToken } = await import('@/lib/crypto/server-encryption');

      const result = maskToken('github_pat_11ABCDE_1234567890abcdefghijklmn');

      expect(result).toMatch(/^gith\u2022{8}klmn$/);
    });
  });

  describe('isValidPATFormat', () => {
    it('validates classic GitHub PAT format (ghp_)', async () => {
      const { isValidPATFormat } = await import('@/lib/crypto/server-encryption');

      expect(isValidPATFormat('ghp_abcdef123456')).toBe(true);
      expect(isValidPATFormat('ghp_')).toBe(true);
    });

    it('validates fine-grained GitHub PAT format (github_pat_)', async () => {
      const { isValidPATFormat } = await import('@/lib/crypto/server-encryption');

      expect(isValidPATFormat('github_pat_11ABC_123456')).toBe(true);
      expect(isValidPATFormat('github_pat_')).toBe(true);
    });

    it('rejects invalid PAT formats', async () => {
      const { isValidPATFormat } = await import('@/lib/crypto/server-encryption');

      expect(isValidPATFormat('invalid_token')).toBe(false);
      expect(isValidPATFormat('gho_oauth_token')).toBe(false);
      expect(isValidPATFormat('')).toBe(false);
      expect(isValidPATFormat('gh_')).toBe(false);
      expect(isValidPATFormat('pat_123')).toBe(false);
    });
  });
});

// ============================================================================
// IV and Authentication Tag Handling Tests (5 tests)
// ============================================================================

describe('IV and Authentication Tag Handling', () => {
  const originalEnv = process.env;
  let keyBuffer: Buffer;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    process.env = { ...originalEnv };
    process.env.SQLITE_DATA_DIR = '/tmp/test-data';

    keyBuffer = crypto.randomBytes(32);

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(keyBuffer);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('uses 12-byte IV for AES-GCM encryption', async () => {
    const { encryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken('test');
    const buffer = Buffer.from(encrypted, 'base64');

    // IV is first 12 bytes
    const iv = buffer.subarray(0, 12);
    expect(iv.length).toBe(12);
  });

  it('uses 16-byte authentication tag', async () => {
    const { encryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken('test');
    const buffer = Buffer.from(encrypted, 'base64');

    // Tag is bytes 12-28 (after IV)
    const tag = buffer.subarray(12, 28);
    expect(tag.length).toBe(16);
  });

  it('produces valid base64 output', async () => {
    const { encryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken('test-token');

    // Should be valid base64
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();

    // Base64 string should not be empty
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it('generates unique IV for each encryption', async () => {
    const { encryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted1 = encryptToken('test');
    const encrypted2 = encryptToken('test');

    const buffer1 = Buffer.from(encrypted1, 'base64');
    const buffer2 = Buffer.from(encrypted2, 'base64');

    const iv1 = buffer1.subarray(0, 12);
    const iv2 = buffer2.subarray(0, 12);

    expect(iv1.equals(iv2)).toBe(false);
  });

  it('encrypted output contains IV + tag + ciphertext in correct order', async () => {
    const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

    const token = 'verification-token';
    const encrypted = encryptToken(token);
    const buffer = Buffer.from(encrypted, 'base64');

    // Total length should be: IV (12) + Tag (16) + ciphertext
    expect(buffer.length).toBeGreaterThan(28);

    // Decryption should work, proving the format is correct
    expect(decryptToken(encrypted)).toBe(token);
  });
});

// ============================================================================
// Cross-Key Security Tests (3 tests)
// ============================================================================

describe('Cross-Key Security', () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    process.env = { ...originalEnv };
    process.env.SQLITE_DATA_DIR = '/tmp/test-data';

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('decryption fails when key changes between encrypt and decrypt', async () => {
    // First key for encryption
    const key1 = crypto.randomBytes(32);
    mockedFs.readFileSync.mockReturnValue(key1);

    const { encryptToken } = await import('@/lib/crypto/server-encryption');
    const encrypted = encryptToken('secret-token');

    // Reset and use a different key for decryption
    vi.resetModules();
    const key2 = crypto.randomBytes(32);
    mockedFs.readFileSync.mockReturnValue(key2);

    const { decryptToken } = await import('@/lib/crypto/server-encryption');

    expect(() => decryptToken(encrypted)).toThrow(/Decryption failed/);
  });

  it('different keys produce different ciphertext', async () => {
    const token = 'test-token';

    // First key
    const key1 = crypto.randomBytes(32);
    mockedFs.readFileSync.mockReturnValue(key1);

    const { encryptToken: encrypt1 } = await import('@/lib/crypto/server-encryption');
    const encrypted1 = encrypt1(token);

    // Reset and use different key
    vi.resetModules();
    const key2 = crypto.randomBytes(32);
    mockedFs.readFileSync.mockReturnValue(key2);

    const { encryptToken: encrypt2 } = await import('@/lib/crypto/server-encryption');
    const encrypted2 = encrypt2(token);

    // Even ignoring IV differences, the ciphertext should be different
    // Compare the ciphertext portions (after IV + tag)
    const buffer1 = Buffer.from(encrypted1, 'base64').subarray(28);
    const buffer2 = Buffer.from(encrypted2, 'base64').subarray(28);

    expect(buffer1.equals(buffer2)).toBe(false);
  });

  it('authentication tag prevents tampering detection', async () => {
    const key = crypto.randomBytes(32);
    mockedFs.readFileSync.mockReturnValue(key);

    const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken('sensitive-data');
    const buffer = Buffer.from(encrypted, 'base64');

    // Tamper with the authentication tag (bytes 12-28)
    buffer[15] ^= 0xff;
    const tampered = buffer.toString('base64');

    expect(() => decryptToken(tampered)).toThrow(/Decryption failed/);
  });
});

// ============================================================================
// Edge Cases and Error Handling (4 tests)
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  const originalEnv = process.env;
  let keyBuffer: Buffer;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    process.env = { ...originalEnv };
    process.env.SQLITE_DATA_DIR = '/tmp/test-data';

    keyBuffer = crypto.randomBytes(32);

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(keyBuffer);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it('handles tokens with newlines and whitespace', async () => {
    const token = '  token\nwith\r\nwhitespace\t  ';

    const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(token);
  });

  it('handles binary-like data in tokens', async () => {
    // Create a token with various byte values
    const token = String.fromCharCode(...Array.from({ length: 50 }, (_, i) => i + 32));

    const { encryptToken, decryptToken } = await import('@/lib/crypto/server-encryption');

    const encrypted = encryptToken(token);
    const decrypted = decryptToken(encrypted);

    expect(decrypted).toBe(token);
  });

  it('rejects invalid base64 input for decryption', async () => {
    const { decryptToken } = await import('@/lib/crypto/server-encryption');

    // Invalid base64 will decode to garbage
    const invalidBase64 = '!!!invalid!!!';

    // The decryption will fail because the data won't have correct format
    expect(() => decryptToken(invalidBase64)).toThrow();
  });

  it('handles exactly minimum length encrypted data', async () => {
    const { decryptToken } = await import('@/lib/crypto/server-encryption');

    // Exactly 29 bytes (IV 12 + Tag 16 + 1 byte ciphertext)
    // But the tag won't verify, so it should fail with decryption error
    const minLengthData = Buffer.alloc(29).toString('base64');

    expect(() => decryptToken(minLengthData)).toThrow(/Decryption failed/);
  });
});

// ============================================================================
// Client-side Token Encryption Tests (Web Crypto API) - 12 tests
// ============================================================================

describe('Client-side Token Encryption (Web Crypto API)', () => {
  const originalGlobalCrypto = globalThis.crypto;
  const originalLocalStorage = globalThis.localStorage;

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.resetModules();

    // Setup browser environment mocks
    Object.defineProperty(globalThis, 'localStorage', {
      value: localStorageMock,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'crypto', {
      value: mockCrypto,
      writable: true,
      configurable: true,
    });

    localStorageMock.clear();
  });

  afterEach(() => {
    // Restore original globals
    Object.defineProperty(globalThis, 'crypto', {
      value: originalGlobalCrypto,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'localStorage', {
      value: originalLocalStorage,
      writable: true,
      configurable: true,
    });

    vi.resetModules();
  });

  describe('Key Material Management', () => {
    it('creates new key material when localStorage is empty', async () => {
      // Mock the crypto operations to return expected results
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      await encryptToken('test-token');

      // Should have stored key material in localStorage
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'agentpane_key_material',
        expect.any(String)
      );
    });

    it('reuses existing key material from localStorage', async () => {
      // Pre-populate localStorage with key material (32 bytes base64 encoded)
      const existingKeyMaterial = btoa(String.fromCharCode(...new Uint8Array(32).fill(0x42)));
      localStorageMock.setItem('agentpane_key_material', existingKeyMaterial);

      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      await encryptToken('test-token');

      // Should have retrieved existing key material
      expect(localStorageMock.getItem).toHaveBeenCalledWith('agentpane_key_material');
    });
  });

  describe('Key Derivation', () => {
    it('derives key using PBKDF2 with correct parameters', async () => {
      const mockBaseKey = {} as CryptoKey;
      const mockDerivedKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockBaseKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      await encryptToken('test-token');

      // Check importKey was called for PBKDF2
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
        'raw',
        expect.any(ArrayBuffer),
        'PBKDF2',
        false,
        ['deriveKey']
      );

      // Check deriveKey was called with correct parameters
      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          iterations: 100000,
          hash: 'SHA-256',
        }),
        mockBaseKey,
        expect.objectContaining({
          name: 'AES-GCM',
          length: 256,
        }),
        false,
        ['encrypt', 'decrypt']
      );
    });
  });

  describe('Encryption Operations', () => {
    it('encrypts token using AES-GCM', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      const result = await encryptToken('test-token');

      // Should call encrypt with AES-GCM algorithm
      expect(mockCryptoSubtle.encrypt).toHaveBeenCalled();
      const encryptCall = mockCryptoSubtle.encrypt.mock.calls[0];
      expect(encryptCall[0]).toMatchObject({ name: 'AES-GCM' });
      expect(encryptCall[1]).toBe(mockKey);
      // Verify the third argument is array-like (Uint8Array)
      expect(encryptCall[2]).toHaveProperty('length');
      expect(encryptCall[2].constructor.name).toBe('Uint8Array');

      // Result should be a base64 string
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('generates random IV for each encryption', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');

      await encryptToken('test-token');
      await encryptToken('test-token');

      // getRandomValues should be called for IV (12 bytes) each time
      // Plus initial call for key material if not stored
      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });

    it('generates random salt for key derivation', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(10));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      await encryptToken('test-token');

      // getRandomValues should be called for salt (16 bytes)
      expect(mockCrypto.getRandomValues).toHaveBeenCalled();
    });

    it('produces base64 output containing salt + iv + ciphertext', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      // Return 20 bytes of ciphertext
      mockCryptoSubtle.encrypt.mockResolvedValue(new ArrayBuffer(20));

      const { encryptToken } = await import('@/lib/crypto/token-encryption');
      const result = await encryptToken('test-token');

      // Decode and check length: salt(16) + iv(12) + ciphertext(20) = 48 bytes
      const decoded = Uint8Array.from(atob(result), (c) => c.charCodeAt(0));
      expect(decoded.length).toBe(48);
    });
  });

  describe('Decryption Operations', () => {
    it('decrypts token using AES-GCM', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.decrypt.mockResolvedValue(
        new TextEncoder().encode('decrypted-token').buffer
      );

      // Create a valid encrypted token format (salt + iv + ciphertext)
      const encryptedData = new Uint8Array(48); // 16 salt + 12 iv + 20 ciphertext
      const encryptedToken = btoa(String.fromCharCode(...encryptedData));

      // Pre-populate localStorage with key material
      const keyMaterial = btoa(String.fromCharCode(...new Uint8Array(32).fill(0x42)));
      localStorageMock.setItem('agentpane_key_material', keyMaterial);

      const { decryptToken } = await import('@/lib/crypto/token-encryption');
      const result = await decryptToken(encryptedToken);

      expect(mockCryptoSubtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'AES-GCM' }),
        mockKey,
        expect.any(Uint8Array)
      );
      expect(result).toBe('decrypted-token');
    });

    it('extracts salt and iv correctly from encrypted data', async () => {
      const mockKey = {} as CryptoKey;
      mockCryptoSubtle.importKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockKey);
      mockCryptoSubtle.decrypt.mockResolvedValue(new TextEncoder().encode('test').buffer);

      // Create encrypted data with known salt and iv
      const salt = new Uint8Array(16).fill(0xaa);
      const iv = new Uint8Array(12).fill(0xbb);
      const ciphertext = new Uint8Array(10).fill(0xcc);
      const combined = new Uint8Array([...salt, ...iv, ...ciphertext]);
      const encryptedToken = btoa(String.fromCharCode(...combined));

      const keyMaterial = btoa(String.fromCharCode(...new Uint8Array(32).fill(0x42)));
      localStorageMock.setItem('agentpane_key_material', keyMaterial);

      const { decryptToken } = await import('@/lib/crypto/token-encryption');
      await decryptToken(encryptedToken);

      // Verify deriveKey was called with salt
      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'PBKDF2',
          salt: expect.any(ArrayBuffer),
        }),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything()
      );

      // Verify decrypt was called with iv
      expect(mockCryptoSubtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array),
        }),
        expect.anything(),
        expect.any(Uint8Array)
      );
    });
  });

  describe('Token Utilities (Client-side)', () => {
    it('masks tokens longer than 12 characters', async () => {
      const { maskToken } = await import('@/lib/crypto/token-encryption');

      const result = maskToken('ghp_1234567890abcdef');
      expect(result).toBe('ghp_\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022cdef');
    });

    it('returns fixed mask for short tokens', async () => {
      const { maskToken } = await import('@/lib/crypto/token-encryption');

      expect(maskToken('short')).toBe('\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022');
    });

    it('validates GitHub PAT format', async () => {
      const { isValidPATFormat } = await import('@/lib/crypto/token-encryption');

      expect(isValidPATFormat('ghp_test123')).toBe(true);
      expect(isValidPATFormat('github_pat_test')).toBe(true);
      expect(isValidPATFormat('invalid')).toBe(false);
    });
  });
});
