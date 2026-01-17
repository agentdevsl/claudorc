import { describe, expect, it } from 'vitest';
import { err, isErr, isOk, map, mapErr, ok, unwrap, unwrapOr } from '../result.js';

describe('result utilities', () => {
  it('ok() returns success result', () => {
    const result = ok('value');

    expect(result).toEqual({ ok: true, value: 'value' });
  });

  it('err() returns error result', () => {
    const result = err(new Error('boom'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('boom');
    }
  });

  it('isOk/isErr narrow result types', () => {
    const success = ok(123);
    const failure = err('bad');

    if (isOk(success)) {
      expect(success.value).toBe(123);
    }

    if (isErr(failure)) {
      expect(failure.error).toBe('bad');
    }
  });

  it('map() transforms success value', () => {
    const result = map(ok(2), (value) => value * 3);

    expect(result).toEqual({ ok: true, value: 6 });
  });

  it('mapErr() transforms error value', () => {
    const result = mapErr(err('oops'), (error) => `${error}!`);

    expect(result).toEqual({ ok: false, error: 'oops!' });
  });

  it('unwrap() returns value on success', () => {
    const result = unwrap(ok('yes'));

    expect(result).toBe('yes');
  });

  it('unwrap() throws on error', () => {
    expect(() => unwrap(err('nope'))).toThrow('nope');
  });

  it('unwrapOr() returns default on error', () => {
    const result = unwrapOr(err('missing'), 'fallback');

    expect(result).toBe('fallback');
  });
});
