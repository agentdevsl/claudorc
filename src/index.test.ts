/**
 * Example tests demonstrating TDD patterns with Vitest.
 * Tests are written FIRST, then implementation follows.
 */

import { describe, expect, it } from 'vitest';
import { delay, greet, VERSION } from './index.js';

describe('index', () => {
  describe('VERSION', () => {
    it('should export a version string', () => {
      expect(VERSION).toBe('1.0.0');
    });
  });

  describe('greet', () => {
    it('should return a greeting with the provided name', () => {
      const result = greet('World');

      expect(result).toBe('Hello, World!');
    });

    it('should throw an error for empty name', () => {
      expect(() => greet('')).toThrow('Name cannot be empty');
    });

    it('should throw an error for whitespace-only name', () => {
      expect(() => greet('   ')).toThrow('Name cannot be empty');
    });
  });

  describe('delay', () => {
    it('should resolve after the specified time', async () => {
      const start = Date.now();

      await delay(50);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow small variance
    });
  });
});
