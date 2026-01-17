import { describe, expect, it } from 'vitest';
import { createCursor, decodeCursor, encodeCursor } from '../cursor.js';

describe('cursor utilities', () => {
  it('encodes and decodes cursor', () => {
    const cursor = encodeCursor({
      id: 'item-1',
      sortValue: 'updated',
      sortField: 'updatedAt',
      order: 'desc',
    });

    const decoded = decodeCursor(cursor);

    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.id).toBe('item-1');
    }
  });

  it('creates cursor from item', () => {
    const cursor = createCursor({ id: 'item-1', updatedAt: 'now' }, 'updatedAt', 'desc');

    expect(typeof cursor).toBe('string');
  });
});
