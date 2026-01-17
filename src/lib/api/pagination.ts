import type { CursorPayload, CursorResult } from './cursor.js';
import { decodeCursor } from './cursor.js';

export type ValidateCursorOptions = {
  sortField: string;
  order: 'asc' | 'desc';
  maxAgeMs?: number;
};

export const validateCursor = (
  cursor: string,
  options: ValidateCursorOptions
): CursorResult<CursorPayload> => {
  const decoded = decodeCursor(cursor);
  if (!decoded.ok) {
    return decoded;
  }

  const payload = decoded.value;

  if (payload.sortField !== options.sortField || payload.order !== options.order) {
    return { ok: false, error: 'INVALID_CURSOR' };
  }

  return { ok: true, value: payload };
};
