/**
 * Server-side secure token encryption using Node.js crypto
 *
 * Tokens are encrypted with AES-256-GCM before storage.
 * The encryption key is stored in the data directory or derived from env.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_FILE = 'encryption.key';

/**
 * Get the data directory for storing the encryption key
 */
function getDataDir(): string {
  return process.env.SQLITE_DATA_DIR || './data';
}

/**
 * Get or create the encryption key
 * Stored in the data directory as a file
 */
function getOrCreateKey(): Buffer {
  const dataDir = getDataDir();
  const keyPath = path.join(dataDir, KEY_FILE);

  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath);
  }

  // Generate new random key (256 bits = 32 bytes)
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key, { mode: 0o600 }); // Read/write only for owner

  return key;
}

/**
 * Encrypt a token for secure storage
 * Returns base64-encoded string containing iv + tag + ciphertext
 */
export function encryptToken(token: string): string {
  const key = getOrCreateKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine iv + tag + ciphertext
  const combined = Buffer.concat([iv, tag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a token from storage
 */
export function decryptToken(encryptedToken: string): string {
  const key = getOrCreateKey();
  const combined = Buffer.from(encryptedToken, 'base64');

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Mask a token for display (show first 4 and last 4 chars)
 */
export function maskToken(token: string): string {
  if (token.length <= 12) {
    return '••••••••';
  }
  return `${token.slice(0, 4)}${'•'.repeat(8)}${token.slice(-4)}`;
}

/**
 * Validate GitHub PAT format
 * GitHub PATs start with 'ghp_' (classic) or 'github_pat_' (fine-grained)
 */
export function isValidPATFormat(token: string): boolean {
  return token.startsWith('ghp_') || token.startsWith('github_pat_');
}
