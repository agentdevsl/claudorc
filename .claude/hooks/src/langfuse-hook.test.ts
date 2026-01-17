/**
 * Tests for Langfuse Hook utilities
 * Uses realistic Claude Code event structures
 */

import { describe, expect, it } from 'vitest';
import {
  analyzeToolResult,
  type ClaudeCodeEvent,
  getSubagentInfo,
  isSubagentTool,
  isValidEvent,
  stringify,
  truncate,
} from './utils.js';

// Realistic test fixtures matching Claude Code events
const fixtures = {
  bashSuccess: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_use_id: 'toolu_01ABC123',
    tool_input: {
      command: 'go test -v ./internal/provider/...',
      description: 'Run provider tests',
      timeout: 120000,
    },
    tool_response: {
      exit_code: 0,
      stdout: 'PASS\nok  \tterraform-provider-bcm/internal/provider\t1.234s',
      stderr: '',
    },
  } as ClaudeCodeEvent,

  bashError: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Bash',
    tool_use_id: 'toolu_01DEF456',
    tool_input: {
      command: 'make build',
      description: 'Build the provider',
    },
    tool_response: {
      exit_code: 2,
      stdout: '',
      stderr: 'internal/provider/resource_category.go:45:12: undefined: someVar',
    },
  } as ClaudeCodeEvent,

  readFile: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Read',
    tool_use_id: 'toolu_01GHI789',
    tool_input: {
      file_path: '/workspace/terraform-provider-bcm/internal/provider/provider.go',
    },
    tool_response: {
      content: 'package provider\n\nimport (\n\t"context"\n...',
    },
  } as ClaudeCodeEvent,

  globSearch: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Glob',
    tool_use_id: 'toolu_01JKL012',
    tool_input: {
      pattern: '**/*_test.go',
      path: '/workspace/terraform-provider-bcm',
    },
    tool_response: {
      files: [
        '/workspace/terraform-provider-bcm/internal/provider/provider_test.go',
        '/workspace/terraform-provider-bcm/internal/provider/resource_category_test.go',
      ],
    },
  } as ClaudeCodeEvent,

  subagentExplore: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Task',
    tool_use_id: 'toolu_01MNO345',
    tool_input: {
      subagent_type: 'Explore',
      description: 'Find auth handlers',
      model: 'sonnet',
      prompt:
        'Search the codebase for authentication and authorization handling code. Look for login, session management, and permission checks.',
    },
    tool_response: {
      result: 'Found authentication code in internal/provider/bcm_client.go...',
    },
  } as ClaudeCodeEvent,

  subagentCodeReview: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'Task',
    tool_use_id: 'toolu_01PQR678',
    tool_input: {
      subagent_type: 'pr-review-toolkit:code-reviewer',
      description: 'Review recent changes',
      prompt: 'Review the unstaged changes for code quality issues.',
    },
    tool_response: {
      result: 'Code review complete. Found 2 minor issues...',
    },
  } as ClaudeCodeEvent,

  webFetch: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'WebFetch',
    tool_use_id: 'toolu_01STU901',
    tool_input: {
      url: 'https://developer.hashicorp.com/terraform/plugin/framework',
      prompt: 'Extract the key concepts for plugin framework',
    },
    tool_response: {
      statusCode: 200,
      content: 'The Terraform Plugin Framework is...',
    },
  } as ClaudeCodeEvent,

  webFetchError: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'PostToolUse',
    tool_name: 'WebFetch',
    tool_use_id: 'toolu_01VWX234',
    tool_input: {
      url: 'https://example.com/nonexistent',
      prompt: 'Get content',
    },
    tool_response: {
      statusCode: 404,
      error: 'Page not found',
    },
  } as ClaudeCodeEvent,

  stopEvent: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'Stop',
  } as ClaudeCodeEvent,

  subagentStopEvent: {
    session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    cwd: '/workspace/terraform-provider-bcm',
    permission_mode: 'default',
    hook_event_name: 'SubagentStop',
    stop_hook_active: true,
  } as ClaudeCodeEvent,
};

describe('isValidEvent', () => {
  it('accepts Bash command event', () => {
    expect(isValidEvent(fixtures.bashSuccess)).toBe(true);
  });

  it('accepts Read file event', () => {
    expect(isValidEvent(fixtures.readFile)).toBe(true);
  });

  it('accepts Glob search event', () => {
    expect(isValidEvent(fixtures.globSearch)).toBe(true);
  });

  it('accepts Task/subagent event', () => {
    expect(isValidEvent(fixtures.subagentExplore)).toBe(true);
  });

  it('accepts Stop event', () => {
    expect(isValidEvent(fixtures.stopEvent)).toBe(true);
  });

  it('accepts SubagentStop event', () => {
    expect(isValidEvent(fixtures.subagentStopEvent)).toBe(true);
  });

  it('rejects missing session_id', () => {
    expect(isValidEvent({ cwd: '/workspace', hook_event_name: 'Stop' })).toBe(false);
  });

  it('rejects empty session_id', () => {
    expect(isValidEvent({ session_id: '', cwd: '/workspace', hook_event_name: 'Stop' })).toBe(
      false
    );
  });

  it('rejects invalid hook_event_name', () => {
    expect(
      isValidEvent({ session_id: 'test', cwd: '/workspace', hook_event_name: 'Invalid' })
    ).toBe(false);
  });

  it('rejects null input', () => {
    expect(isValidEvent(null)).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isValidEvent('string')).toBe(false);
  });
});

describe('analyzeToolResult', () => {
  describe('Bash tool responses', () => {
    it('success: exit code 0 with stdout', () => {
      const r = analyzeToolResult(fixtures.bashSuccess.tool_response);
      expect(r.success).toBe(true);
      expect(r.exitCode).toBe(0);
      expect(r.error).toBeNull();
    });

    it('error: non-zero exit code with stderr', () => {
      const r = analyzeToolResult(fixtures.bashError.tool_response);
      expect(r.success).toBe(false);
      expect(r.exitCode).toBe(2);
      expect(r.error).toContain('undefined: someVar');
      expect(r.errorType).toBe('exit_code');
    });

    it('error: command not found (exit 127)', () => {
      const r = analyzeToolResult({ exit_code: 127, stderr: 'bash: foo: command not found' });
      expect(r.success).toBe(false);
      expect(r.exitCode).toBe(127);
      expect(r.error).toContain('command not found');
    });

    it('error: permission denied (exit 126)', () => {
      const r = analyzeToolResult({
        exit_code: 126,
        stderr: 'bash: ./script.sh: Permission denied',
      });
      expect(r.success).toBe(false);
      expect(r.exitCode).toBe(126);
    });

    it('error: timeout', () => {
      const r = analyzeToolResult({ timedOut: true, exit_code: null });
      expect(r.success).toBe(false);
      expect(r.errorType).toBe('timeout');
      expect(r.error).toBe('Timed out');
    });
  });

  describe('WebFetch tool responses', () => {
    it('success: HTTP 200', () => {
      const r = analyzeToolResult(fixtures.webFetch.tool_response);
      expect(r.success).toBe(true);
    });

    it('error: HTTP 404 with error field (error takes precedence)', () => {
      const r = analyzeToolResult(fixtures.webFetchError.tool_response);
      expect(r.success).toBe(false);
      expect(r.error).toBe('Page not found');
      expect(r.errorType).toBe('error');
    });

    it('error: HTTP 404 status only', () => {
      const r = analyzeToolResult({ statusCode: 404 });
      expect(r.success).toBe(false);
      expect(r.error).toBe('HTTP 404');
      expect(r.errorType).toBe('http_client_error');
    });

    it('error: HTTP 500 status only', () => {
      const r = analyzeToolResult({ statusCode: 500 });
      expect(r.success).toBe(false);
      expect(r.error).toBe('HTTP 500');
      expect(r.errorType).toBe('http_server_error');
    });

    it('error: HTTP 503 service unavailable', () => {
      const r = analyzeToolResult({ statusCode: 503 });
      expect(r.success).toBe(false);
      expect(r.error).toBe('HTTP 503');
      expect(r.errorType).toBe('http_server_error');
    });
  });

  describe('File operation responses', () => {
    it('success: file read', () => {
      const r = analyzeToolResult(fixtures.readFile.tool_response);
      expect(r.success).toBe(true);
    });

    it('error: file not found', () => {
      const r = analyzeToolResult({ notFound: true });
      expect(r.success).toBe(false);
      expect(r.error).toBe('Not found');
      expect(r.errorType).toBe('not_found');
    });

    it('error: permission denied', () => {
      const r = analyzeToolResult({ permissionDenied: true });
      expect(r.success).toBe(false);
      expect(r.error).toBe('Permission denied');
      expect(r.errorType).toBe('permission_denied');
    });
  });

  describe('Generic responses', () => {
    it('error: explicit error field', () => {
      const r = analyzeToolResult({ error: 'Something went wrong' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('Something went wrong');
      expect(r.errorType).toBe('error');
    });

    it('error: success=false with message', () => {
      const r = analyzeToolResult({ success: false, message: 'Operation failed' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('Operation failed');
      expect(r.errorType).toBe('failed');
    });

    it('error: success=false with reason', () => {
      const r = analyzeToolResult({ success: false, reason: 'Invalid input' });
      expect(r.success).toBe(false);
      expect(r.error).toBe('Invalid input');
    });

    it('error: cancelled by user', () => {
      const r = analyzeToolResult({ cancelled: true });
      expect(r.success).toBe(false);
      expect(r.errorType).toBe('cancelled');
    });

    it('success: null response', () => {
      expect(analyzeToolResult(null).success).toBe(true);
    });

    it('success: undefined response', () => {
      expect(analyzeToolResult(undefined).success).toBe(true);
    });

    it('success: string response', () => {
      expect(analyzeToolResult('Operation completed').success).toBe(true);
    });
  });
});

describe('getSubagentInfo', () => {
  it('extracts Explore subagent info', () => {
    const info = getSubagentInfo(fixtures.subagentExplore.tool_input);
    expect(info).not.toBeNull();
    expect(info?.type).toBe('Explore');
    expect(info?.description).toBe('Find auth handlers');
    expect(info?.model).toBe('sonnet');
    expect(info?.prompt_preview).toContain('Search the codebase');
  });

  it('extracts code-reviewer subagent info', () => {
    const info = getSubagentInfo(fixtures.subagentCodeReview.tool_input);
    expect(info).not.toBeNull();
    expect(info?.type).toBe('pr-review-toolkit:code-reviewer');
    expect(info?.description).toBe('Review recent changes');
  });

  it('truncates long prompts to 200 chars', () => {
    const longPrompt = 'Search for '.repeat(50);
    const info = getSubagentInfo({
      subagent_type: 'Explore',
      prompt: longPrompt,
    });
    expect(info?.prompt_preview.length).toBeLessThanOrEqual(200);
    expect(info?.prompt_preview.endsWith('...')).toBe(true);
  });

  it('returns null for non-Task tool input', () => {
    const info = getSubagentInfo(fixtures.bashSuccess.tool_input);
    expect(info).toBeNull();
  });

  it('returns null for undefined input', () => {
    const info = getSubagentInfo(undefined);
    expect(info).toBeNull();
  });

  it('returns null for empty object', () => {
    const info = getSubagentInfo({});
    expect(info).toBeNull();
  });

  it('handles missing optional fields', () => {
    const info = getSubagentInfo({ subagent_type: 'Explore' });
    expect(info).not.toBeNull();
    expect(info?.type).toBe('Explore');
    expect(info?.description).toBe('');
    expect(info?.model).toBeUndefined();
    expect(info?.prompt_preview).toBe('');
  });
});

describe('stringify', () => {
  it('returns short strings as-is', () => {
    expect(stringify('hello')).toBe('hello');
  });

  it('truncates long strings', () => {
    const long = 'a'.repeat(600);
    const r = stringify(long);
    expect(r.length).toBe(500);
    expect(r.endsWith('...')).toBe(true);
  });

  it('stringifies objects', () => {
    expect(stringify({ command: 'ls -la' })).toBe('{"command":"ls -la"}');
  });

  it('stringifies arrays', () => {
    expect(stringify(['a', 'b'])).toBe('["a","b"]');
  });

  it('handles null', () => {
    expect(stringify(null)).toBe('null');
  });

  it('handles numbers', () => {
    expect(stringify(42)).toBe('42');
  });
});

describe('truncate', () => {
  it('returns short strings as-is', () => {
    expect(truncate('hello')).toBe('hello');
  });

  it('truncates at default max (500)', () => {
    const long = 'a'.repeat(600);
    const r = truncate(long);
    expect(r.length).toBe(500);
    expect(r.endsWith('...')).toBe(true);
  });

  it('truncates at custom max', () => {
    const r = truncate('hello world', 8);
    expect(r).toBe('hello...');
    expect(r.length).toBe(8);
  });

  it('handles exact length', () => {
    const r = truncate('hello', 5);
    expect(r).toBe('hello');
  });

  it('handles length just over limit', () => {
    const r = truncate('hello!', 5);
    expect(r).toBe('he...');
  });
});

describe('isSubagentTool', () => {
  it('returns true for Task tool', () => {
    expect(isSubagentTool('Task')).toBe(true);
  });

  it('returns true for runSubagent tool', () => {
    expect(isSubagentTool('runSubagent')).toBe(true);
  });

  it('returns false for Bash tool', () => {
    expect(isSubagentTool('Bash')).toBe(false);
  });

  it('returns false for Read tool', () => {
    expect(isSubagentTool('Read')).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isSubagentTool(undefined)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isSubagentTool('')).toBe(false);
  });
});

describe('Multiple Tool Calls', () => {
  // Fixtures for multi-tool scenarios
  const multiToolFixtures = {
    // PreToolUse events
    preToolBash: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PreToolUse',
      tool_name: 'Bash',
      tool_use_id: 'toolu_multi_01',
      tool_input: { command: 'npm test', description: 'Run unit tests' },
    } as ClaudeCodeEvent,

    preToolRead: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PreToolUse',
      tool_name: 'Read',
      tool_use_id: 'toolu_multi_02',
      tool_input: { file_path: '/workspace/project/package.json' },
    } as ClaudeCodeEvent,

    preToolGrep: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PreToolUse',
      tool_name: 'Grep',
      tool_use_id: 'toolu_multi_03',
      tool_input: { pattern: 'export.*function', path: '/workspace/project/src' },
    } as ClaudeCodeEvent,

    // PostToolUse events (matching the PreToolUse)
    postToolBash: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_use_id: 'toolu_multi_01',
      tool_input: { command: 'npm test', description: 'Run unit tests' },
      tool_response: { exit_code: 0, stdout: 'Tests passed: 42\nFailed: 0' },
    } as ClaudeCodeEvent,

    postToolRead: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_use_id: 'toolu_multi_02',
      tool_input: { file_path: '/workspace/project/package.json' },
      tool_response: { content: '{"name": "project", "version": "1.0.0"}' },
    } as ClaudeCodeEvent,

    postToolGrep: {
      session_id: 'multi-tool-session-001',
      cwd: '/workspace/project',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Grep',
      tool_use_id: 'toolu_multi_03',
      tool_input: { pattern: 'export.*function', path: '/workspace/project/src' },
      tool_response: { files: ['src/utils.ts', 'src/index.ts'], matches: 15 },
    } as ClaudeCodeEvent,
  };

  describe('PreToolUse event validation', () => {
    it('validates sequential PreToolUse events with unique tool_use_ids', () => {
      expect(isValidEvent(multiToolFixtures.preToolBash)).toBe(true);
      expect(isValidEvent(multiToolFixtures.preToolRead)).toBe(true);
      expect(isValidEvent(multiToolFixtures.preToolGrep)).toBe(true);

      // Ensure unique tool_use_ids
      const ids = new Set([
        multiToolFixtures.preToolBash.tool_use_id,
        multiToolFixtures.preToolRead.tool_use_id,
        multiToolFixtures.preToolGrep.tool_use_id,
      ]);
      expect(ids.size).toBe(3);
    });

    it('all events share same session_id', () => {
      expect(multiToolFixtures.preToolBash.session_id).toBe('multi-tool-session-001');
      expect(multiToolFixtures.preToolRead.session_id).toBe('multi-tool-session-001');
      expect(multiToolFixtures.preToolGrep.session_id).toBe('multi-tool-session-001');
    });
  });

  describe('PostToolUse event validation', () => {
    it('validates PostToolUse events match PreToolUse tool_use_ids', () => {
      expect(multiToolFixtures.postToolBash.tool_use_id).toBe(
        multiToolFixtures.preToolBash.tool_use_id
      );
      expect(multiToolFixtures.postToolRead.tool_use_id).toBe(
        multiToolFixtures.preToolRead.tool_use_id
      );
      expect(multiToolFixtures.postToolGrep.tool_use_id).toBe(
        multiToolFixtures.preToolGrep.tool_use_id
      );
    });

    it('analyzes multiple tool results correctly', () => {
      const bashResult = analyzeToolResult(multiToolFixtures.postToolBash.tool_response);
      const readResult = analyzeToolResult(multiToolFixtures.postToolRead.tool_response);
      const grepResult = analyzeToolResult(multiToolFixtures.postToolGrep.tool_response);

      expect(bashResult.success).toBe(true);
      expect(bashResult.exitCode).toBe(0);
      expect(readResult.success).toBe(true);
      expect(grepResult.success).toBe(true);
    });
  });

  describe('Mixed success/failure multi-tool scenarios', () => {
    const mixedScenario = {
      bashSuccess: {
        session_id: 'mixed-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_use_id: 'toolu_mix_01',
        tool_response: { exit_code: 0, stdout: 'Build successful' },
      } as ClaudeCodeEvent,

      bashFailed: {
        session_id: 'mixed-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Bash',
        tool_use_id: 'toolu_mix_02',
        tool_response: { exit_code: 1, stderr: 'Error: tests failed' },
      } as ClaudeCodeEvent,

      webFetchTimeout: {
        session_id: 'mixed-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'WebFetch',
        tool_use_id: 'toolu_mix_03',
        tool_response: { timedOut: true },
      } as ClaudeCodeEvent,

      readNotFound: {
        session_id: 'mixed-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Read',
        tool_use_id: 'toolu_mix_04',
        tool_response: { notFound: true },
      } as ClaudeCodeEvent,
    };

    it('correctly categorizes success vs failure across multiple tools', () => {
      const results = [
        analyzeToolResult(mixedScenario.bashSuccess.tool_response),
        analyzeToolResult(mixedScenario.bashFailed.tool_response),
        analyzeToolResult(mixedScenario.webFetchTimeout.tool_response),
        analyzeToolResult(mixedScenario.readNotFound.tool_response),
      ];

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].errorType).toBe('exit_code');
      expect(results[2].success).toBe(false);
      expect(results[2].errorType).toBe('timeout');
      expect(results[3].success).toBe(false);
      expect(results[3].errorType).toBe('not_found');
    });

    it('all events in mixed scenario are valid', () => {
      Object.values(mixedScenario).forEach((event) => {
        expect(isValidEvent(event)).toBe(true);
      });
    });
  });
});

describe('Subagent Scenarios', () => {
  // Comprehensive subagent fixtures
  const subagentFixtures = {
    // Explore subagent
    exploreSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_01',
      tool_input: {
        subagent_type: 'Explore',
        description: 'Find authentication code',
        model: 'haiku',
        prompt:
          'Search the codebase for all authentication and authorization handling. Look for login flows, session management, JWT handling, and permission checks.',
      },
      tool_response: { result: 'Found auth code in internal/auth/handler.go...' },
    } as ClaudeCodeEvent,

    // Plan subagent
    planSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_02',
      tool_input: {
        subagent_type: 'Plan',
        description: 'Design new feature architecture',
        model: 'sonnet',
        prompt:
          'Analyze the existing architecture and propose a design for adding webhook support with retry logic.',
      },
      tool_response: { result: 'Architecture proposal: Use event-driven pattern...' },
    } as ClaudeCodeEvent,

    // Code reviewer subagent
    codeReviewerSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_03',
      tool_input: {
        subagent_type: 'pr-review-toolkit:code-reviewer',
        description: 'Review PR changes',
        prompt:
          'Review all unstaged changes for code quality, security issues, and adherence to project guidelines.',
      },
      tool_response: { result: 'Review complete. 2 high-priority issues found.' },
    } as ClaudeCodeEvent,

    // Feature dev architect subagent
    featureArchitectSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_04',
      tool_input: {
        subagent_type: 'feature-dev:code-architect',
        description: 'Design CRUD implementation',
        model: 'opus',
        prompt:
          'Design the implementation for a new resource type following existing patterns in the codebase.',
      },
      tool_response: { result: 'Implementation blueprint created...' },
    } as ClaudeCodeEvent,

    // General purpose subagent
    generalPurposeSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_05',
      tool_input: {
        subagent_type: 'general-purpose',
        description: 'Complex multi-step task',
        prompt: 'Research, implement, and test the new feature end-to-end.',
      },
      tool_response: { result: 'Task completed successfully.' },
    } as ClaudeCodeEvent,

    // Speckit subagent
    speckitSubagent: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_06',
      tool_input: {
        subagent_type: 'speckit.implement',
        description: 'Execute implementation tasks',
        prompt: 'Execute all tasks defined in tasks.md for the current feature.',
      },
      tool_response: { result: 'Implementation complete. 5 tasks executed.' },
    } as ClaudeCodeEvent,

    // Subagent with token/model info
    subagentWithMetrics: {
      session_id: 'subagent-session-001',
      cwd: '/workspace/terraform-provider',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_sub_07',
      tool_input: {
        subagent_type: 'Explore',
        description: 'Quick search',
        model: 'haiku',
        prompt: 'Find all TODO comments in the codebase.',
      },
      tool_response: { result: 'Found 15 TODO comments.' },
      model: 'claude-sonnet-4-20250514',
      tokens: { input: 1500, output: 800, total: 2300 },
      user_id: 'user_123',
    } as ClaudeCodeEvent,
  };

  describe('Subagent type extraction', () => {
    it('extracts Explore subagent info correctly', () => {
      const info = getSubagentInfo(subagentFixtures.exploreSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('Explore');
      expect(info?.description).toBe('Find authentication code');
      expect(info?.model).toBe('haiku');
      expect(info?.prompt_preview).toContain('authentication');
    });

    it('extracts Plan subagent info correctly', () => {
      const info = getSubagentInfo(subagentFixtures.planSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('Plan');
      expect(info?.model).toBe('sonnet');
    });

    it('extracts namespaced subagent types (pr-review-toolkit:code-reviewer)', () => {
      const info = getSubagentInfo(subagentFixtures.codeReviewerSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('pr-review-toolkit:code-reviewer');
    });

    it('extracts namespaced subagent types (feature-dev:code-architect)', () => {
      const info = getSubagentInfo(subagentFixtures.featureArchitectSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('feature-dev:code-architect');
      expect(info?.model).toBe('opus');
    });

    it('extracts speckit subagent types', () => {
      const info = getSubagentInfo(subagentFixtures.speckitSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('speckit.implement');
    });

    it('extracts general-purpose subagent info', () => {
      const info = getSubagentInfo(subagentFixtures.generalPurposeSubagent.tool_input);
      expect(info).not.toBeNull();
      expect(info?.type).toBe('general-purpose');
    });
  });

  describe('Subagent isSubagentTool detection', () => {
    it('identifies all Task tool variants as subagents', () => {
      Object.values(subagentFixtures).forEach((fixture) => {
        expect(isSubagentTool(fixture.tool_name)).toBe(true);
      });
    });

    it('correctly differentiates subagent from regular tools', () => {
      expect(isSubagentTool('Task')).toBe(true);
      expect(isSubagentTool('Bash')).toBe(false);
      expect(isSubagentTool('Read')).toBe(false);
      expect(isSubagentTool('Write')).toBe(false);
      expect(isSubagentTool('Edit')).toBe(false);
      expect(isSubagentTool('Glob')).toBe(false);
      expect(isSubagentTool('Grep')).toBe(false);
      expect(isSubagentTool('WebFetch')).toBe(false);
    });
  });

  describe('Subagent event validation', () => {
    it('validates all subagent fixtures as valid events', () => {
      Object.values(subagentFixtures).forEach((fixture) => {
        expect(isValidEvent(fixture)).toBe(true);
      });
    });

    it('all subagent fixtures share session_id', () => {
      const sessionIds = Object.values(subagentFixtures).map((f) => f.session_id);
      expect(new Set(sessionIds).size).toBe(1);
    });

    it('each subagent has unique tool_use_id', () => {
      const toolUseIds = Object.values(subagentFixtures).map((f) => f.tool_use_id);
      expect(new Set(toolUseIds).size).toBe(toolUseIds.length);
    });
  });

  describe('Subagent with extra metadata', () => {
    it('preserves model info when present', () => {
      expect(subagentFixtures.subagentWithMetrics.model).toBe('claude-sonnet-4-20250514');
    });

    it('preserves token counts when present', () => {
      expect(subagentFixtures.subagentWithMetrics.tokens).toEqual({
        input: 1500,
        output: 800,
        total: 2300,
      });
    });

    it('preserves user_id when present', () => {
      expect(subagentFixtures.subagentWithMetrics.user_id).toBe('user_123');
    });
  });

  describe('Multiple subagents in sequence', () => {
    it('correctly processes a realistic subagent workflow', () => {
      // Simulate: Explore -> Plan -> Implement workflow
      const workflow = [
        subagentFixtures.exploreSubagent,
        subagentFixtures.planSubagent,
        subagentFixtures.featureArchitectSubagent,
        subagentFixtures.codeReviewerSubagent,
      ];

      const results = workflow.map((event) => ({
        isValid: isValidEvent(event),
        isSubagent: isSubagentTool(event.tool_name),
        subagentInfo: getSubagentInfo(event.tool_input),
        toolResult: analyzeToolResult(event.tool_response),
      }));

      // All should be valid events
      expect(results.every((r) => r.isValid)).toBe(true);
      // All should be identified as subagents
      expect(results.every((r) => r.isSubagent)).toBe(true);
      // All should have subagent info extracted
      expect(results.every((r) => r.subagentInfo !== null)).toBe(true);
      // All should have successful tool results
      expect(results.every((r) => r.toolResult.success)).toBe(true);
    });
  });

  describe('Subagent error scenarios', () => {
    const errorSubagents = {
      subagentFailed: {
        session_id: 'error-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Task',
        tool_use_id: 'toolu_err_01',
        tool_input: {
          subagent_type: 'Explore',
          description: 'Failed search',
          prompt: 'Search for nonexistent pattern',
        },
        tool_response: { success: false, message: 'No matches found' },
      } as ClaudeCodeEvent,

      subagentError: {
        session_id: 'error-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Task',
        tool_use_id: 'toolu_err_02',
        tool_input: {
          subagent_type: 'feature-dev:code-reviewer',
          description: 'Review error',
          prompt: 'Review the changes',
        },
        tool_response: { error: 'Rate limit exceeded' },
      } as ClaudeCodeEvent,

      subagentCancelled: {
        session_id: 'error-session-001',
        cwd: '/workspace',
        permission_mode: 'default',
        hook_event_name: 'PostToolUse',
        tool_name: 'Task',
        tool_use_id: 'toolu_err_03',
        tool_input: {
          subagent_type: 'general-purpose',
          description: 'Cancelled task',
          prompt: 'Long running task',
        },
        tool_response: { cancelled: true },
      } as ClaudeCodeEvent,
    };

    it('detects subagent failure with success:false', () => {
      const result = analyzeToolResult(errorSubagents.subagentFailed.tool_response);
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('failed');
      expect(result.error).toContain('No matches found');
    });

    it('detects subagent error with error field', () => {
      const result = analyzeToolResult(errorSubagents.subagentError.tool_response);
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('error');
      expect(result.error).toContain('Rate limit');
    });

    it('detects cancelled subagent', () => {
      const result = analyzeToolResult(errorSubagents.subagentCancelled.tool_response);
      expect(result.success).toBe(false);
      expect(result.errorType).toBe('cancelled');
    });

    it('extracts subagent info even on failure', () => {
      Object.values(errorSubagents).forEach((fixture) => {
        const info = getSubagentInfo(fixture.tool_input);
        expect(info).not.toBeNull();
        expect(isSubagentTool(fixture.tool_name)).toBe(true);
      });
    });
  });
});

describe('Combined Multi-Tool and Subagent Workflows', () => {
  // Realistic workflow combining regular tools with subagents
  const workflowFixtures = {
    // Step 1: Read configuration
    readConfig: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Read',
      tool_use_id: 'toolu_wf_01',
      tool_input: { file_path: '/workspace/app/config.json' },
      tool_response: { content: '{"version": "2.0", "features": ["auth"]}' },
    } as ClaudeCodeEvent,

    // Step 2: Explore codebase with subagent
    exploreCodebase: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_wf_02',
      tool_input: {
        subagent_type: 'Explore',
        description: 'Find auth implementation',
        model: 'haiku',
        prompt: 'Find all files related to authentication feature.',
      },
      tool_response: { result: 'Found: src/auth/login.ts, src/auth/session.ts' },
    } as ClaudeCodeEvent,

    // Step 3: Search with Grep
    searchCode: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Grep',
      tool_use_id: 'toolu_wf_03',
      tool_input: { pattern: 'validateToken', path: '/workspace/app/src' },
      tool_response: { files: ['src/auth/session.ts'], matches: 3 },
    } as ClaudeCodeEvent,

    // Step 4: Plan changes with subagent
    planChanges: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_wf_04',
      tool_input: {
        subagent_type: 'Plan',
        description: 'Plan auth improvements',
        model: 'sonnet',
        prompt: 'Create a plan to add refresh token support to the auth system.',
      },
      tool_response: { result: 'Plan: 1. Add refresh token generation...' },
    } as ClaudeCodeEvent,

    // Step 5: Edit file
    editFile: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Edit',
      tool_use_id: 'toolu_wf_05',
      tool_input: {
        file_path: '/workspace/app/src/auth/session.ts',
        old_string: 'export function validateToken',
        new_string: 'export function validateToken // TODO: add refresh',
      },
      tool_response: { success: true },
    } as ClaudeCodeEvent,

    // Step 6: Run tests
    runTests: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_use_id: 'toolu_wf_06',
      tool_input: { command: 'npm test -- --coverage', description: 'Run tests with coverage' },
      tool_response: { exit_code: 0, stdout: 'Tests: 42 passed\nCoverage: 87%' },
    } as ClaudeCodeEvent,

    // Step 7: Code review with subagent
    codeReview: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Task',
      tool_use_id: 'toolu_wf_07',
      tool_input: {
        subagent_type: 'pr-review-toolkit:code-reviewer',
        description: 'Review changes before commit',
        prompt: 'Review the changes made to auth/session.ts for security issues.',
      },
      tool_response: { result: 'Review complete. No critical issues found.' },
    } as ClaudeCodeEvent,

    // Step 8: Create commit
    gitCommit: {
      session_id: 'workflow-session-001',
      cwd: '/workspace/app',
      permission_mode: 'default',
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_use_id: 'toolu_wf_08',
      tool_input: {
        command: 'git commit -m "Add refresh token support"',
        description: 'Commit changes',
      },
      tool_response: { exit_code: 0, stdout: '[main abc1234] Add refresh token support' },
    } as ClaudeCodeEvent,
  };

  it('all workflow events are valid', () => {
    Object.values(workflowFixtures).forEach((event) => {
      expect(isValidEvent(event)).toBe(true);
    });
  });

  it('correctly identifies subagents vs regular tools in workflow', () => {
    const toolTypes = Object.entries(workflowFixtures).map(([key, event]) => ({
      step: key,
      isSubagent: isSubagentTool(event.tool_name),
      toolName: event.tool_name,
    }));

    // Regular tools
    expect(toolTypes.find((t) => t.step === 'readConfig')?.isSubagent).toBe(false);
    expect(toolTypes.find((t) => t.step === 'searchCode')?.isSubagent).toBe(false);
    expect(toolTypes.find((t) => t.step === 'editFile')?.isSubagent).toBe(false);
    expect(toolTypes.find((t) => t.step === 'runTests')?.isSubagent).toBe(false);
    expect(toolTypes.find((t) => t.step === 'gitCommit')?.isSubagent).toBe(false);

    // Subagents
    expect(toolTypes.find((t) => t.step === 'exploreCodebase')?.isSubagent).toBe(true);
    expect(toolTypes.find((t) => t.step === 'planChanges')?.isSubagent).toBe(true);
    expect(toolTypes.find((t) => t.step === 'codeReview')?.isSubagent).toBe(true);
  });

  it('extracts subagent info only from Task tools', () => {
    Object.values(workflowFixtures).forEach((event) => {
      const info = getSubagentInfo(event.tool_input);
      if (event.tool_name === 'Task') {
        expect(info).not.toBeNull();
        expect(info?.type).toBeDefined();
      } else {
        // Regular tools may return null or have no subagent_type
        if (info !== null) {
          expect(info.type).not.toBe('Task'); // Should not be detected as Task subagent
        }
      }
    });
  });

  it('all tool results in workflow are successful', () => {
    Object.values(workflowFixtures).forEach((event) => {
      const result = analyzeToolResult(event.tool_response);
      expect(result.success).toBe(true);
    });
  });

  it('workflow maintains consistent session across all events', () => {
    const sessionIds = Object.values(workflowFixtures).map((e) => e.session_id);
    expect(new Set(sessionIds).size).toBe(1);
    expect(sessionIds[0]).toBe('workflow-session-001');
  });

  it('workflow has unique tool_use_ids for all events', () => {
    const ids = Object.values(workflowFixtures).map((e) => e.tool_use_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('counts subagent usage correctly in workflow', () => {
    const subagentCount = Object.values(workflowFixtures).filter((event) =>
      isSubagentTool(event.tool_name)
    ).length;
    expect(subagentCount).toBe(3); // Explore, Plan, code-reviewer
  });

  it('counts regular tool usage correctly in workflow', () => {
    const regularToolCount = Object.values(workflowFixtures).filter(
      (event) => !isSubagentTool(event.tool_name)
    ).length;
    expect(regularToolCount).toBe(5); // Read, Grep, Edit, 2x Bash
  });
});
