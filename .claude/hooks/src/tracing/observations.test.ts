/**
 * Unit tests for the observations module.
 * Focused on formatStatusMessage and related formatting functions.
 */
import { describe, expect, it } from 'vitest';
import { formatStatusMessage } from './observations.js';
import type { ToolResult } from './types.js';

describe('formatStatusMessage', () => {
  describe('success cases', () => {
    it('should return undefined for successful tool execution', () => {
      const result: ToolResult = { success: true };
      expect(formatStatusMessage(result)).toBeUndefined();
    });

    it('should return undefined for successful tool with output', () => {
      const result: ToolResult = {
        success: true,
        output: 'some output',
        durationMs: 1000,
      };
      expect(formatStatusMessage(result)).toBeUndefined();
    });
  });

  describe('error type formatting', () => {
    it('should format timeout error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'timeout',
        error: 'Command timed out',
      };
      const message = formatStatusMessage(result, 'Bash');
      expect(message).toContain('[TIMEOUT]');
      expect(message).toContain('Bash');
    });

    it('should format exit_code error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'exit_code',
        exitCode: 1,
        error: 'Command failed',
      };
      const message = formatStatusMessage(result, 'Bash');
      expect(message).toContain('[EXIT_CODE]');
      expect(message).toContain('exit=1');
    });

    it('should format permission_denied error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'permission_denied',
        error: 'Access denied',
      };
      const message = formatStatusMessage(result, 'Read');
      expect(message).toContain('[PERMISSION_DENIED]');
      expect(message).toContain('Read');
    });

    it('should format http_server_error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'http_server_error',
        error: '500 Internal Server Error',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('[HTTP_SERVER_ERROR]');
    });

    it('should format http_client_error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'http_client_error',
        error: '404 Not Found',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('[HTTP_CLIENT_ERROR]');
    });

    it('should format cancelled error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'cancelled',
        error: 'User cancelled',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('[CANCELLED]');
    });

    it('should format incomplete error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'incomplete',
        error: 'Session ended unexpectedly',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('[INCOMPLETE]');
    });

    it('should format not_found error type', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'not_found',
        error: 'File not found',
      };
      const message = formatStatusMessage(result, 'Read');
      expect(message).toContain('[NOT_FOUND]');
    });
  });

  describe('error message truncation', () => {
    it('should not truncate short error messages', () => {
      const shortError = 'Short error message';
      const result: ToolResult = {
        success: false,
        error: shortError,
      };
      const message = formatStatusMessage(result);
      expect(message).toContain(`- ${shortError}`);
      expect(message).not.toContain('...');
    });

    it('should truncate messages exactly at 100 characters', () => {
      const exactlyHundred = 'a'.repeat(100);
      const result: ToolResult = {
        success: false,
        error: exactlyHundred,
      };
      const message = formatStatusMessage(result);
      expect(message).toContain(`- ${exactlyHundred}`);
      expect(message).not.toContain('...');
    });

    it('should truncate messages longer than 100 characters with ellipsis', () => {
      const longError = 'a'.repeat(150);
      const result: ToolResult = {
        success: false,
        error: longError,
      };
      const message = formatStatusMessage(result);
      expect(message).toContain(`- ${'a'.repeat(100)}...`);
      expect(message).not.toContain('a'.repeat(101));
    });

    it('should handle very long error messages', () => {
      const veryLongError = `${'Error: '.repeat(100)}final part`;
      const result: ToolResult = {
        success: false,
        error: veryLongError,
      };
      const message = formatStatusMessage(result);
      // The error part should be truncated to 100 chars + "..."
      const errorPart = message?.split('- ')[1];
      expect(errorPart?.length).toBe(103); // 100 chars + "..."
    });
  });

  describe('exit code handling', () => {
    it('should include non-zero exit code', () => {
      const result: ToolResult = {
        success: false,
        exitCode: 1,
        error: 'Command failed',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('exit=1');
    });

    it('should include large exit codes', () => {
      const result: ToolResult = {
        success: false,
        exitCode: 137,
        error: 'Killed',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('exit=137');
    });

    it('should not include zero exit code', () => {
      const result: ToolResult = {
        success: false,
        exitCode: 0,
        error: 'Some error',
      };
      const message = formatStatusMessage(result);
      expect(message).not.toContain('exit=');
    });

    it('should not include exit code when undefined', () => {
      const result: ToolResult = {
        success: false,
        error: 'Some error',
      };
      const message = formatStatusMessage(result);
      expect(message).not.toContain('exit=');
    });
  });

  describe('duration handling', () => {
    it('should include duration when over 30 seconds', () => {
      const result: ToolResult = {
        success: false,
        durationMs: 45000, // 45 seconds
        error: 'Timeout',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('duration=45s');
    });

    it('should round duration to nearest second', () => {
      const result: ToolResult = {
        success: false,
        durationMs: 35500, // 35.5 seconds
        error: 'Slow',
      };
      const message = formatStatusMessage(result);
      expect(message).toContain('duration=36s');
    });

    it('should not include duration at exactly 30 seconds', () => {
      const result: ToolResult = {
        success: false,
        durationMs: 30000, // exactly 30 seconds
        error: 'Some error',
      };
      const message = formatStatusMessage(result);
      expect(message).not.toContain('duration=');
    });

    it('should not include duration under 30 seconds', () => {
      const result: ToolResult = {
        success: false,
        durationMs: 5000, // 5 seconds
        error: 'Some error',
      };
      const message = formatStatusMessage(result);
      expect(message).not.toContain('duration=');
    });

    it('should not include duration when undefined', () => {
      const result: ToolResult = {
        success: false,
        error: 'Some error',
      };
      const message = formatStatusMessage(result);
      expect(message).not.toContain('duration=');
    });
  });

  describe('combined formatting', () => {
    it('should format all parts together correctly', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'timeout',
        exitCode: 137,
        durationMs: 120000, // 2 minutes
        error: 'Command timed out waiting for response',
      };
      const message = formatStatusMessage(result, 'Bash');
      expect(message).toBe(
        '[TIMEOUT] Bash exit=137 duration=120s - Command timed out waiting for response'
      );
    });

    it('should format without tool name', () => {
      const result: ToolResult = {
        success: false,
        errorType: 'error',
        error: 'Something went wrong',
      };
      const message = formatStatusMessage(result);
      expect(message).toBe('[ERROR] - Something went wrong');
    });

    it('should format with only error message', () => {
      const result: ToolResult = {
        success: false,
        error: 'Simple error',
      };
      const message = formatStatusMessage(result);
      expect(message).toBe('- Simple error');
    });

    it('should return undefined for failure with no details', () => {
      const result: ToolResult = {
        success: false,
      };
      const message = formatStatusMessage(result);
      expect(message).toBeUndefined();
    });
  });
});
