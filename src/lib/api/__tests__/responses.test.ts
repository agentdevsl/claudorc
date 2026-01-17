import { describe, expect, it } from 'vitest';
import { failure, success } from '../response.js';

describe('api responses', () => {
  it('builds success response', () => {
    expect(success({ ok: true })).toEqual({ ok: true, data: { ok: true } });
  });

  it('builds failure response', () => {
    const error = { code: 'ERR', message: 'nope', status: 400 };
    expect(failure(error)).toEqual({
      ok: false,
      error: { code: 'ERR', message: 'nope', details: undefined },
    });
  });
});
