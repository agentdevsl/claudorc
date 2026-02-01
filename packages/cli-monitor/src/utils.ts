/** Generate a short random ID (8 hex chars) */
export function createId(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Extract a human-readable message from an unknown error value */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
