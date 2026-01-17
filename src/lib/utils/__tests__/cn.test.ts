import { describe, expect, it } from 'vitest';
import { cn } from '../cn.js';

describe('cn utility', () => {
  describe('basic string handling', () => {
    it('returns empty string when called with no arguments', () => {
      const result = cn();

      expect(result).toBe('');
    });

    it('returns single class name unchanged', () => {
      const result = cn('foo');

      expect(result).toBe('foo');
    });

    it('merges multiple string class names', () => {
      const result = cn('foo', 'bar', 'baz');

      expect(result).toBe('foo bar baz');
    });

    it('handles class names with multiple classes in a single string', () => {
      const result = cn('foo bar', 'baz qux');

      expect(result).toBe('foo bar baz qux');
    });
  });

  describe('falsy value handling', () => {
    it('filters out null values', () => {
      const result = cn('foo', null, 'bar');

      expect(result).toBe('foo bar');
    });

    it('filters out undefined values', () => {
      const result = cn('foo', undefined, 'bar');

      expect(result).toBe('foo bar');
    });

    it('filters out false values', () => {
      const result = cn('foo', false, 'bar');

      expect(result).toBe('foo bar');
    });

    it('filters out empty string values', () => {
      const result = cn('foo', '', 'bar');

      expect(result).toBe('foo bar');
    });

    it('filters out zero values', () => {
      const result = cn('foo', 0, 'bar');

      expect(result).toBe('foo bar');
    });

    it('returns empty string when all values are falsy', () => {
      const result = cn(null, undefined, false, '', 0);

      expect(result).toBe('');
    });
  });

  describe('number handling', () => {
    it('converts positive numbers to strings', () => {
      const result = cn('foo', 42, 'bar');

      expect(result).toBe('foo 42 bar');
    });

    it('converts negative numbers to strings', () => {
      const result = cn('foo', -1, 'bar');

      expect(result).toBe('foo -1 bar');
    });

    it('converts decimal numbers to strings', () => {
      const result = cn('foo', 3.14, 'bar');

      expect(result).toBe('foo 3.14 bar');
    });
  });

  describe('boolean handling', () => {
    it('filters out false boolean', () => {
      const result = cn('foo', false, 'bar');

      expect(result).toBe('foo bar');
    });

    it('converts true to string "true"', () => {
      const result = cn('foo', true, 'bar');

      expect(result).toBe('foo true bar');
    });
  });

  describe('array handling', () => {
    it('flattens array of class names', () => {
      const result = cn(['foo', 'bar']);

      expect(result).toBe('foo bar');
    });

    it('merges arrays with other values', () => {
      const result = cn('baz', ['foo', 'bar'], 'qux');

      expect(result).toBe('baz foo bar qux');
    });

    it('handles nested arrays', () => {
      const result = cn(['foo', ['bar', 'baz']]);

      expect(result).toBe('foo bar baz');
    });

    it('handles deeply nested arrays', () => {
      const result = cn(['foo', ['bar', ['baz', ['qux']]]]);

      expect(result).toBe('foo bar baz qux');
    });

    it('filters out falsy values in arrays', () => {
      const result = cn(['foo', null, 'bar', undefined, false, '']);

      expect(result).toBe('foo bar');
    });

    it('handles empty arrays', () => {
      const result = cn('foo', [], 'bar');

      expect(result).toBe('foo bar');
    });

    it('handles arrays with only falsy values', () => {
      const result = cn([null, undefined, false, '']);

      expect(result).toBe('');
    });
  });

  describe('object handling (conditional classes)', () => {
    it('includes keys with truthy values', () => {
      const result = cn({ foo: true, bar: true });

      expect(result).toBe('foo bar');
    });

    it('excludes keys with falsy values', () => {
      const result = cn({ foo: true, bar: false, baz: true });

      expect(result).toBe('foo baz');
    });

    it('handles mixed object values', () => {
      const result = cn({
        foo: true,
        bar: false,
        baz: 1,
        qux: 0,
        quux: 'truthy',
        corge: '',
        grault: null,
        garply: undefined,
      });

      // Only truthy values are included: true, 1, 'truthy'
      // 0, false, '', null, undefined are all falsy
      expect(result).toBe('foo baz quux');
    });

    it('merges objects with other values', () => {
      const result = cn('base', { active: true, disabled: false }, 'extra');

      expect(result).toBe('base active extra');
    });

    it('handles empty objects', () => {
      const result = cn('foo', {}, 'bar');

      expect(result).toBe('foo bar');
    });

    it('handles objects with all false values', () => {
      const result = cn({ foo: false, bar: false });

      expect(result).toBe('');
    });
  });

  describe('mixed input types', () => {
    it('handles complex mixed inputs', () => {
      const result = cn(
        'base',
        ['arr1', 'arr2'],
        { conditional: true, hidden: false },
        null,
        undefined,
        'final'
      );

      expect(result).toBe('base arr1 arr2 conditional final');
    });

    it('handles arrays containing objects', () => {
      const result = cn(['foo', { bar: true, baz: false }]);

      expect(result).toBe('foo bar');
    });

    it('handles deeply nested mixed types', () => {
      const result = cn([
        'a',
        ['b', { c: true, d: false }],
        [['e', { f: true }]],
      ]);

      expect(result).toBe('a b c e f');
    });
  });

  describe('tailwind class handling', () => {
    it('preserves tailwind utility classes', () => {
      const result = cn('px-4', 'py-2', 'bg-blue-500');

      expect(result).toBe('px-4 py-2 bg-blue-500');
    });

    it('preserves multiple tailwind classes in sequence', () => {
      const result = cn(
        'flex',
        'items-center',
        'justify-between',
        'w-full',
        'h-screen'
      );

      expect(result).toBe('flex items-center justify-between w-full h-screen');
    });

    it('handles conditional tailwind classes', () => {
      const isActive = true;
      const isDisabled = false;

      const result = cn('btn', {
        'bg-blue-500': isActive,
        'opacity-50': isDisabled,
        'cursor-pointer': isActive,
        'cursor-not-allowed': isDisabled,
      });

      expect(result).toBe('btn bg-blue-500 cursor-pointer');
    });

    it('handles responsive tailwind classes', () => {
      const result = cn('w-full', 'md:w-1/2', 'lg:w-1/3');

      expect(result).toBe('w-full md:w-1/2 lg:w-1/3');
    });

    it('handles state variant tailwind classes', () => {
      const result = cn(
        'bg-white',
        'hover:bg-gray-100',
        'focus:ring-2',
        'active:bg-gray-200'
      );

      expect(result).toBe(
        'bg-white hover:bg-gray-100 focus:ring-2 active:bg-gray-200'
      );
    });

    it('handles arbitrary value tailwind classes', () => {
      const result = cn('w-[200px]', 'h-[calc(100vh-64px)]', 'bg-[#ff0000]');

      expect(result).toBe('w-[200px] h-[calc(100vh-64px)] bg-[#ff0000]');
    });

    it('does not deduplicate conflicting tailwind classes', () => {
      const result = cn('p-2', 'p-4');

      expect(result).toBe('p-2 p-4');
    });

    it('does not deduplicate different tailwind classes for same property', () => {
      const result = cn('text-red-500', 'text-blue-500');

      expect(result).toBe('text-red-500 text-blue-500');
    });
  });

  describe('real-world usage patterns', () => {
    it('handles component variant pattern', () => {
      const variant = 'primary';
      const size = 'large';

      const result = cn(
        'btn',
        {
          'btn-primary': variant === 'primary',
          'btn-secondary': variant === 'secondary',
        },
        {
          'btn-sm': size === 'small',
          'btn-lg': size === 'large',
        }
      );

      expect(result).toBe('btn btn-primary btn-lg');
    });

    it('handles className prop merging pattern', () => {
      const baseClasses = 'flex items-center gap-2';
      const userClassName = 'custom-class';

      const result = cn(baseClasses, userClassName);

      expect(result).toBe('flex items-center gap-2 custom-class');
    });

    it('handles optional className prop', () => {
      const baseClasses = 'flex items-center';
      const userClassName: string | undefined = undefined;

      const result = cn(baseClasses, userClassName);

      expect(result).toBe('flex items-center');
    });

    it('handles array spread pattern', () => {
      const conditionalClasses = ['class1', 'class2'];

      const result = cn('base', ...conditionalClasses);

      expect(result).toBe('base class1 class2');
    });

    it('handles inline conditional expressions', () => {
      const isVisible = true;
      const hasError = false;

      const result = cn(
        'input',
        isVisible && 'visible',
        hasError && 'error',
        !hasError && 'valid'
      );

      expect(result).toBe('input visible valid');
    });

    it('handles CVA-style base and variant pattern', () => {
      const base = 'inline-flex items-center justify-center rounded-md';
      const variants = {
        intent: {
          primary: 'bg-blue-500 text-white',
          secondary: 'bg-gray-200 text-gray-800',
        },
        size: {
          sm: 'px-2 py-1 text-sm',
          md: 'px-4 py-2 text-base',
        },
      };

      const result = cn(
        base,
        variants.intent.primary,
        variants.size.md
      );

      expect(result).toBe(
        'inline-flex items-center justify-center rounded-md bg-blue-500 text-white px-4 py-2 text-base'
      );
    });
  });

  describe('edge cases', () => {
    it('handles whitespace-only strings', () => {
      const result = cn('foo', '   ', 'bar');

      // '   ' (3 spaces) is treated as a truthy string, so it's included
      // Result is 'foo' + ' ' + '   ' + ' ' + 'bar' = 'foo     bar' (5 spaces total)
      expect(result).toBe('foo     bar');
    });

    it('handles strings with extra whitespace', () => {
      const result = cn('  foo  ', '  bar  ');

      expect(result).toBe('  foo     bar  ');
    });

    it('handles special characters in class names', () => {
      const result = cn('foo-bar', 'baz_qux', 'quux:corge');

      expect(result).toBe('foo-bar baz_qux quux:corge');
    });

    it('handles very long class strings', () => {
      const longClass = 'a'.repeat(1000);
      const result = cn(longClass);

      expect(result).toBe(longClass);
    });

    it('handles many arguments', () => {
      const classes = Array.from({ length: 100 }, (_, i) => `class-${i}`);
      const result = cn(...classes);

      expect(result).toBe(classes.join(' '));
    });

    it('handles object keys with special characters', () => {
      const result = cn({
        'foo-bar': true,
        'baz:qux': true,
        'quux/corge': false,
      });

      expect(result).toBe('foo-bar baz:qux');
    });
  });
});
