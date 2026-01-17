import { describe, expect, it } from 'vitest';
import { encodeCursor } from '../cursor.js';
import { validateCursor, type ValidateCursorOptions } from '../pagination.js';

describe('validateCursor', () => {
  const defaultOptions: ValidateCursorOptions = {
    sortField: 'updatedAt',
    order: 'desc',
  };

  describe('valid cursors', () => {
    it('returns ok for cursor matching sortField and order', () => {
      const cursor = encodeCursor({
        id: 'item-123',
        sortValue: '2024-01-01T00:00:00Z',
        sortField: 'updatedAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, defaultOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('item-123');
        expect(result.value.sortField).toBe('updatedAt');
        expect(result.value.order).toBe('desc');
        expect(result.value.sortValue).toBe('2024-01-01T00:00:00Z');
      }
    });

    it('returns ok for cursor with ascending order', () => {
      const cursor = encodeCursor({
        id: 'item-456',
        sortValue: 100,
        sortField: 'createdAt',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'createdAt',
        order: 'asc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('item-456');
        expect(result.value.order).toBe('asc');
      }
    });

    it('returns ok for cursor with numeric sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-789',
        sortValue: 42,
        sortField: 'priority',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'priority',
        order: 'desc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe(42);
      }
    });

    it('returns ok for cursor with null sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-null',
        sortValue: null,
        sortField: 'deletedAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'deletedAt',
        order: 'desc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBeNull();
      }
    });
  });

  describe('invalid cursors - sortField mismatch', () => {
    it('returns error when sortField does not match', () => {
      const cursor = encodeCursor({
        id: 'item-123',
        sortValue: 'value',
        sortField: 'createdAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'updatedAt',
        order: 'desc',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });
  });

  describe('invalid cursors - order mismatch', () => {
    it('returns error when order does not match (asc vs desc)', () => {
      const cursor = encodeCursor({
        id: 'item-123',
        sortValue: 'value',
        sortField: 'updatedAt',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'updatedAt',
        order: 'desc',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error when order does not match (desc vs asc)', () => {
      const cursor = encodeCursor({
        id: 'item-123',
        sortValue: 'value',
        sortField: 'updatedAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'updatedAt',
        order: 'asc',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });
  });

  describe('invalid cursors - both sortField and order mismatch', () => {
    it('returns error when both sortField and order do not match', () => {
      const cursor = encodeCursor({
        id: 'item-123',
        sortValue: 'value',
        sortField: 'createdAt',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'updatedAt',
        order: 'desc',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });
  });

  describe('invalid cursors - malformed input', () => {
    it('returns error for completely invalid base64', () => {
      const result = validateCursor('!!!not-valid-base64!!!', defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error for empty string', () => {
      const result = validateCursor('', defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error for valid base64 with invalid JSON', () => {
      const invalidJson = Buffer.from('not json', 'utf-8').toString('base64');
      const result = validateCursor(invalidJson, defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error for valid base64 JSON with missing fields', () => {
      const incompletePayload = Buffer.from(
        JSON.stringify({ id: 'item-1' }),
        'utf-8'
      ).toString('base64');

      const result = validateCursor(incompletePayload, defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error for cursor with wrong version', () => {
      const wrongVersionPayload = Buffer.from(
        JSON.stringify({
          id: 'item-1',
          sortValue: 'value',
          sortField: 'updatedAt',
          order: 'desc',
          version: 999,
        }),
        'utf-8'
      ).toString('base64');

      const result = validateCursor(wrongVersionPayload, defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });

    it('returns error for cursor with invalid order value', () => {
      const invalidOrderPayload = Buffer.from(
        JSON.stringify({
          id: 'item-1',
          sortValue: 'value',
          sortField: 'updatedAt',
          order: 'invalid',
          version: 1,
        }),
        'utf-8'
      ).toString('base64');

      const result = validateCursor(invalidOrderPayload, defaultOptions);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe('INVALID_CURSOR');
      }
    });
  });

  describe('edge cases', () => {
    it('handles cursor with special characters in id', () => {
      const cursor = encodeCursor({
        id: 'item-with-special-chars_123/456',
        sortValue: 'value',
        sortField: 'updatedAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, defaultOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe('item-with-special-chars_123/456');
      }
    });

    it('handles cursor with unicode sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-unicode',
        sortValue: 'Hello World',
        sortField: 'name',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'name',
        order: 'asc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe('Hello World');
      }
    });

    it('handles cursor with empty string sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-empty',
        sortValue: '',
        sortField: 'description',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'description',
        order: 'desc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe('');
      }
    });

    it('handles cursor with very long id', () => {
      const longId = 'a'.repeat(1000);
      const cursor = encodeCursor({
        id: longId,
        sortValue: 'value',
        sortField: 'updatedAt',
        order: 'desc',
      });

      const result = validateCursor(cursor, defaultOptions);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.id).toBe(longId);
      }
    });

    it('handles cursor with negative numeric sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-negative',
        sortValue: -42,
        sortField: 'balance',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'balance',
        order: 'asc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe(-42);
      }
    });

    it('handles cursor with zero sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-zero',
        sortValue: 0,
        sortField: 'count',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'count',
        order: 'desc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe(0);
      }
    });

    it('handles cursor with floating point sortValue', () => {
      const cursor = encodeCursor({
        id: 'item-float',
        sortValue: 3.14159,
        sortField: 'rating',
        order: 'desc',
      });

      const result = validateCursor(cursor, {
        sortField: 'rating',
        order: 'desc',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.sortValue).toBe(3.14159);
      }
    });
  });

  describe('ValidateCursorOptions', () => {
    it('accepts options with only required fields', () => {
      const cursor = encodeCursor({
        id: 'item-1',
        sortValue: 'value',
        sortField: 'name',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'name',
        order: 'asc',
      });

      expect(result.ok).toBe(true);
    });

    it('accepts options with maxAgeMs (unused but valid)', () => {
      const cursor = encodeCursor({
        id: 'item-1',
        sortValue: 'value',
        sortField: 'name',
        order: 'asc',
      });

      const result = validateCursor(cursor, {
        sortField: 'name',
        order: 'asc',
        maxAgeMs: 3600000,
      });

      expect(result.ok).toBe(true);
    });
  });
});
