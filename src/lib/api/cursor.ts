import { z } from 'zod';

const CURSOR_VERSION = 1;

const cursorPayloadSchema = z.object({
  id: z.string(),
  sortValue: z.union([z.string(), z.number(), z.null()]),
  sortField: z.string(),
  order: z.enum(['asc', 'desc']),
  version: z.literal(CURSOR_VERSION),
});

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export type CursorResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: 'INVALID_CURSOR' | 'CURSOR_EXPIRED' };

export const encodeCursor = (payload: Omit<CursorPayload, 'version'>): string => {
  const fullPayload: CursorPayload = { ...payload, version: CURSOR_VERSION };
  const json = JSON.stringify(fullPayload);

  return Buffer.from(json, 'utf-8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

export const decodeCursor = (cursor: string): CursorResult<CursorPayload> => {
  try {
    const standard = cursor.replace(/-/g, '+').replace(/_/g, '/');
    const padded = standard + '=='.slice(0, (4 - (standard.length % 4)) % 4);
    const json = Buffer.from(padded, 'base64').toString('utf-8');
    const parsed = JSON.parse(json);
    const validated = cursorPayloadSchema.safeParse(parsed);
    if (!validated.success) {
      return { ok: false, error: 'INVALID_CURSOR' };
    }
    return { ok: true, value: validated.data };
  } catch {
    return { ok: false, error: 'INVALID_CURSOR' };
  }
};

export const createCursor = <T extends { id: string }>(
  item: T,
  sortField: keyof T & string,
  order: 'asc' | 'desc'
): string =>
  encodeCursor({
    id: item.id,
    sortValue: item[sortField] as string | number | null,
    sortField,
    order,
  });
