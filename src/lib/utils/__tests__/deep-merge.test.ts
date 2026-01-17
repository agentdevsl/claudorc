import { describe, expect, it } from 'vitest';
import { deepMerge } from '../deep-merge.js';

describe('deepMerge', () => {
  it('merges shallow properties', () => {
    const result = deepMerge({ name: 'Alpha' }, { status: 'active' });

    expect(result).toEqual({ name: 'Alpha', status: 'active' });
  });

  it('merges nested objects deeply', () => {
    const result = deepMerge(
      { config: { retries: 1, timeout: 1000 } },
      { config: { timeout: 2000, mode: 'fast' } }
    );

    expect(result).toEqual({
      config: { retries: 1, timeout: 2000, mode: 'fast' },
    });
  });

  it('replaces arrays instead of merging', () => {
    const result = deepMerge({ tags: ['a', 'b'] }, { tags: ['c'] });

    expect(result).toEqual({ tags: ['c'] });
  });

  it('does not override with undefined values', () => {
    const result = deepMerge({ count: 4 }, { count: undefined });

    expect(result).toEqual({ count: 4 });
  });

  it('overrides with null values', () => {
    const result = deepMerge({ count: 4 as number | null }, { count: null });

    expect(result).toEqual({ count: null });
  });

  it('handles circular references gracefully', () => {
    const target: { name: string; self?: unknown; meta?: { flag: boolean } } = {
      name: 'root',
    };
    target.self = target;

    const result = deepMerge(target, { meta: { flag: true } });

    expect(result.meta?.flag).toBe(true);
    expect(result.self).toBe(result);
  });
});
