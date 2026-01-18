/**
 * Secure token encryption using Web Crypto API
 *
 * Tokens are encrypted with AES-GCM before storage.
 * The encryption key is derived from a randomly generated secret
 * stored separately in localStorage (not in the database).
 */

const ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const KEY_STORAGE_KEY = 'agentpane_key_material';

/**
 * Get or create the encryption key material
 * Stored in localStorage, separate from the encrypted data
 */
async function getOrCreateKeyMaterial(): Promise<Uint8Array> {
  const stored = localStorage.getItem(KEY_STORAGE_KEY);

  if (stored) {
    return Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
  }

  // Generate new random key material
  const keyMaterial = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(KEY_STORAGE_KEY, btoa(String.fromCharCode(...keyMaterial)));

  return keyMaterial;
}

/**
 * Derive an encryption key from the key material and salt
 */
async function deriveKey(keyMaterial: Uint8Array, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    keyMaterial.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 100000,
      hash: 'SHA-256',
    },
    baseKey,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt a token for secure storage
 * Returns base64-encoded string containing salt + iv + ciphertext
 */
export async function encryptToken(token: string): Promise<string> {
  const keyMaterial = await getOrCreateKeyMaterial();
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(keyMaterial, salt);

  const encoder = new TextEncoder();
  const data = encoder.encode(token);

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, data);

  // Combine salt + iv + ciphertext
  const combined = new Uint8Array(SALT_LENGTH + IV_LENGTH + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_LENGTH);
  combined.set(new Uint8Array(ciphertext), SALT_LENGTH + IV_LENGTH);

  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypt a token from storage
 */
export async function decryptToken(encryptedToken: string): Promise<string> {
  const keyMaterial = await getOrCreateKeyMaterial();

  // Decode and extract components
  const combined = Uint8Array.from(atob(encryptedToken), (c) => c.charCodeAt(0));
  const salt = combined.slice(0, SALT_LENGTH);
  const iv = combined.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const ciphertext = combined.slice(SALT_LENGTH + IV_LENGTH);

  const key = await deriveKey(keyMaterial, salt);

  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext);

  const decoder = new TextDecoder();
  return decoder.decode(decrypted);
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
