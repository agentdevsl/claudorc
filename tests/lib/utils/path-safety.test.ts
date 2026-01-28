/**
 * @vitest-environment node
 */
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  DANGEROUS_PREFIXES,
  getNormalizedPath,
  type PathSafetyCode,
  type PathSafetyResult,
  validatePathForDeletion,
} from '@/lib/utils/path-safety';

// ============================================================================
// Root Path Protection Tests
// ============================================================================

describe('Path Safety - Root Path Protection', () => {
  it('blocks root path /', () => {
    const result = validatePathForDeletion('/');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
      expect(result.reason).toBe('Path matches a protected system directory');
    }
  });

  it('blocks root path even with trailing slash normalization', () => {
    // path.normalize('/') returns '/'
    const result = validatePathForDeletion('/');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });
});

// ============================================================================
// Exact System Directory Protection Tests
// ============================================================================

describe('Path Safety - Exact System Directory Protection', () => {
  const exactSystemDirectories = [
    '/bin',
    '/sbin',
    '/etc',
    '/var',
    '/usr',
    '/lib',
    '/opt',
    '/root',
    '/home',
    '/Users',
    '/System',
    '/Applications',
    '/Library',
  ];

  it.each(exactSystemDirectories)('blocks exact system directory %s', (dir) => {
    const result = validatePathForDeletion(dir);

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
      expect(result.reason).toBe('Path matches a protected system directory');
    }
  });

  it('verifies all DANGEROUS_PREFIXES are correctly defined', () => {
    // Verify the exported constant matches expected values
    expect(DANGEROUS_PREFIXES).toContain('/');
    expect(DANGEROUS_PREFIXES).toContain('/bin');
    expect(DANGEROUS_PREFIXES).toContain('/sbin');
    expect(DANGEROUS_PREFIXES).toContain('/etc');
    expect(DANGEROUS_PREFIXES).toContain('/var');
    expect(DANGEROUS_PREFIXES).toContain('/usr');
    expect(DANGEROUS_PREFIXES).toContain('/lib');
    expect(DANGEROUS_PREFIXES).toContain('/opt');
    expect(DANGEROUS_PREFIXES).toContain('/root');
    expect(DANGEROUS_PREFIXES).toContain('/home');
    expect(DANGEROUS_PREFIXES).toContain('/Users');
    expect(DANGEROUS_PREFIXES).toContain('/System');
    expect(DANGEROUS_PREFIXES).toContain('/Applications');
    expect(DANGEROUS_PREFIXES).toContain('/Library');
  });

  it('blocks system directories with trailing slash after normalization', () => {
    // path.normalize('/etc/') returns '/etc'
    const result = validatePathForDeletion('/etc/');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });
});

// ============================================================================
// Shallow Path Protection Tests (< 3 components)
// ============================================================================

describe('Path Safety - Shallow Path Protection', () => {
  const shallowPaths = [
    { path: '/a', components: 1 },
    { path: '/foo', components: 1 },
    { path: '/a/b', components: 2 },
    { path: '/foo/bar', components: 2 },
    { path: '/home/user', components: 2 },
    { path: '/tmp/work', components: 2 },
  ];

  it.each(shallowPaths)('blocks shallow path $path with $components components (requires >= 3)', ({
    path: testPath,
  }) => {
    const result = validatePathForDeletion(testPath);

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
      expect(result.reason).toBe('Path too shallow - must have at least 3 components');
    }
  });

  it('blocks /home/user as too shallow', () => {
    const result = validatePathForDeletion('/home/user');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
    }
  });

  it('blocks /tmp/data as too shallow', () => {
    const result = validatePathForDeletion('/tmp/data');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
    }
  });
});

// ============================================================================
// Insufficient Depth Under System Prefixes Tests (< 4 components)
// ============================================================================

describe('Path Safety - Insufficient Depth Under System Prefixes', () => {
  const insufficientDepthPaths = [
    { path: '/Users/name/projects', expectedComponents: 3 },
    { path: '/home/user/documents', expectedComponents: 3 },
    { path: '/var/log/app', expectedComponents: 3 },
    { path: '/etc/nginx/conf', expectedComponents: 3 },
    { path: '/opt/app/data', expectedComponents: 3 },
    { path: '/usr/local/bin', expectedComponents: 3 },
    { path: '/Library/Application Support/App', expectedComponents: 3 },
  ];

  it.each(
    insufficientDepthPaths
  )('blocks $path under system prefix with only $expectedComponents components (requires >= 4)', ({
    path: testPath,
  }) => {
    const result = validatePathForDeletion(testPath);

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('INSUFFICIENT_DEPTH');
      expect(result.reason).toBe('Path under system directory must have at least 4 components');
    }
  });

  it('blocks /Users/name/projects (3 components under /Users)', () => {
    const result = validatePathForDeletion('/Users/name/projects');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('INSUFFICIENT_DEPTH');
    }
  });

  it('blocks /home/user/code (3 components under /home)', () => {
    const result = validatePathForDeletion('/home/user/code');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('INSUFFICIENT_DEPTH');
    }
  });
});

// ============================================================================
// Safe Deep Path Tests
// ============================================================================

describe('Path Safety - Safe Deep Paths', () => {
  const safeDeepPaths = [
    '/Users/name/projects/myproject',
    '/home/user/projects/app',
    '/var/www/html/site',
    '/opt/mycompany/app/data',
    '/tmp/user/work/project',
    '/Users/developer/code/repo/subdir',
    '/home/username/workspace/project/src',
  ];

  it.each(safeDeepPaths)('allows safe deep path %s (4+ components)', (testPath) => {
    const result = validatePathForDeletion(testPath);

    expect(result.safe).toBe(true);
  });

  it('allows /Users/name/projects/myproject (4 components under /Users)', () => {
    const result = validatePathForDeletion('/Users/name/projects/myproject');

    expect(result).toEqual({ safe: true });
  });

  it('allows /home/user/projects/app (4 components under /home)', () => {
    const result = validatePathForDeletion('/home/user/projects/app');

    expect(result).toEqual({ safe: true });
  });

  it('allows deeply nested paths', () => {
    const deepPath = '/Users/name/projects/app/src/components/button';
    const result = validatePathForDeletion(deepPath);

    expect(result).toEqual({ safe: true });
  });

  it('allows paths not under dangerous prefixes with 3 components', () => {
    // /foo is not a dangerous prefix, so /foo/bar/baz should be allowed
    const result = validatePathForDeletion('/foo/bar/baz');

    expect(result).toEqual({ safe: true });
  });
});

// ============================================================================
// Path Traversal Attack Tests
// ============================================================================

describe('Path Safety - Path Traversal Handling', () => {
  it('normalizes /tmp/../etc to /etc and blocks it', () => {
    const result = validatePathForDeletion('/tmp/../etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('normalizes /a/b/c/../../../etc to /etc and blocks it', () => {
    const result = validatePathForDeletion('/a/b/c/../../../etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('normalizes /Users/name/../../home to /home and blocks it', () => {
    const result = validatePathForDeletion('/Users/name/../../home');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('normalizes path with multiple .. and blocks if dangerous', () => {
    const result = validatePathForDeletion('/var/log/../../etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('normalizes traversal that results in shallow path', () => {
    // /a/b/c/../.. normalizes to /a
    const result = validatePathForDeletion('/a/b/c/../..');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
    }
  });

  it('normalizes traversal that results in root', () => {
    // /a/.. normalizes to /
    const result = validatePathForDeletion('/a/..');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('allows traversal that results in safe deep path', () => {
    // /Users/name/projects/../projects/myproject normalizes to /Users/name/projects/myproject
    const result = validatePathForDeletion('/Users/name/projects/../projects/myproject');

    expect(result).toEqual({ safe: true });
  });

  it('handles . (current directory) in path', () => {
    const result = validatePathForDeletion('/Users/./name/./projects/./myproject');

    expect(result).toEqual({ safe: true });
  });
});

// ============================================================================
// Relative Path Resolution Tests
// ============================================================================

describe('Path Safety - Relative Path Resolution', () => {
  const originalCwd = process.cwd();

  afterEach(() => {
    // Restore original cwd if needed
    process.chdir(originalCwd);
  });

  it('resolves relative path to absolute using cwd', () => {
    const relativePath = './myproject';
    const normalizedPath = getNormalizedPath(relativePath);

    // Should be resolved relative to cwd
    expect(path.isAbsolute(normalizedPath)).toBe(true);
    expect(normalizedPath).toBe(path.resolve(relativePath));
  });

  it('validates relative path after resolution', () => {
    // Assuming cwd is deeply nested, a relative path should be safe
    // We can't control cwd in tests reliably, so we check the function works
    const result = validatePathForDeletion('./deep/nested/project');

    // Result depends on cwd depth, but function should not throw
    expect(result).toHaveProperty('safe');
  });

  it('resolves .. in relative paths', () => {
    const relativePath = '../sibling/project';
    const normalizedPath = getNormalizedPath(relativePath);

    expect(path.isAbsolute(normalizedPath)).toBe(true);
  });

  it('handles bare directory name', () => {
    const bareName = 'myproject';
    const normalizedPath = getNormalizedPath(bareName);

    expect(path.isAbsolute(normalizedPath)).toBe(true);
    expect(normalizedPath).toBe(path.resolve(bareName));
  });
});

// ============================================================================
// Error Code Verification Tests
// ============================================================================

describe('Path Safety - Error Code Verification', () => {
  it('returns DANGEROUS_PATH code for exact system directory match', () => {
    const result = validatePathForDeletion('/etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code satisfies PathSafetyCode).toBe('DANGEROUS_PATH');
    }
  });

  it('returns TOO_SHALLOW code for paths with < 3 components', () => {
    const result = validatePathForDeletion('/foo/bar');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code satisfies PathSafetyCode).toBe('TOO_SHALLOW');
    }
  });

  it('returns INSUFFICIENT_DEPTH code for system paths with < 4 components', () => {
    const result = validatePathForDeletion('/Users/name/projects');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code satisfies PathSafetyCode).toBe('INSUFFICIENT_DEPTH');
    }
  });

  it('verifies PathSafetyResult type for safe paths', () => {
    const result: PathSafetyResult = validatePathForDeletion('/Users/name/projects/myproject');

    expect(result).toEqual({ safe: true });
  });

  it('verifies PathSafetyResult type for unsafe paths', () => {
    const result: PathSafetyResult = validatePathForDeletion('/etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result).toHaveProperty('reason');
      expect(result).toHaveProperty('code');
      expect(typeof result.reason).toBe('string');
      expect(typeof result.code).toBe('string');
    }
  });
});

// ============================================================================
// getNormalizedPath Utility Tests
// ============================================================================

describe('Path Safety - getNormalizedPath Utility', () => {
  it('returns absolute path for relative input', () => {
    const result = getNormalizedPath('./test');

    expect(path.isAbsolute(result)).toBe(true);
  });

  it('normalizes path with redundant separators', () => {
    const result = getNormalizedPath('/Users//name///projects////myproject');

    expect(result).toBe('/Users/name/projects/myproject');
  });

  it('normalizes path with . components', () => {
    const result = getNormalizedPath('/Users/./name/./projects');

    expect(result).toBe('/Users/name/projects');
  });

  it('normalizes path with .. components', () => {
    const result = getNormalizedPath('/Users/name/../name/projects');

    expect(result).toBe('/Users/name/projects');
  });

  it('returns same path for already normalized absolute path', () => {
    const input = '/Users/name/projects/myproject';
    const result = getNormalizedPath(input);

    expect(result).toBe(input);
  });

  it('resolves relative to current working directory', () => {
    const cwd = process.cwd();
    const result = getNormalizedPath('relative/path');

    expect(result).toBe(path.join(cwd, 'relative/path'));
  });
});

// ============================================================================
// Edge Cases and Boundary Tests
// ============================================================================

describe('Path Safety - Edge Cases', () => {
  it('handles empty path (resolves to cwd)', () => {
    const result = validatePathForDeletion('');

    // Empty string resolves to cwd, which may or may not be safe
    expect(result).toHaveProperty('safe');
  });

  it('handles path with only dots', () => {
    const result = validatePathForDeletion('...');

    // '...' is treated as a directory name, resolved relative to cwd
    expect(result).toHaveProperty('safe');
  });

  it('handles path with spaces', () => {
    const result = validatePathForDeletion('/Users/name/My Projects/app name');

    expect(result).toEqual({ safe: true });
  });

  it('handles path with special characters', () => {
    const result = validatePathForDeletion('/Users/name/projects/my-app_v2.0');

    expect(result).toEqual({ safe: true });
  });

  it('handles path with unicode characters', () => {
    const result = validatePathForDeletion('/Users/name/projects/proyecto');

    expect(result).toEqual({ safe: true });
  });

  it('handles very long paths', () => {
    const longPath = `/Users/name/projects/${'nested/'.repeat(50)}myproject`;
    const result = validatePathForDeletion(longPath);

    expect(result).toEqual({ safe: true });
  });

  it('handles path at exactly 3 components not under dangerous prefix', () => {
    // /foo/bar/baz has 3 components and /foo is not dangerous
    const result = validatePathForDeletion('/foo/bar/baz');

    expect(result).toEqual({ safe: true });
  });

  it('handles path at exactly 4 components under dangerous prefix', () => {
    // /Users/a/b/c has 4 components and /Users is dangerous
    const result = validatePathForDeletion('/Users/a/b/c');

    expect(result).toEqual({ safe: true });
  });

  it('handles paths with trailing slashes', () => {
    const result = validatePathForDeletion('/Users/name/projects/myproject/');

    expect(result).toEqual({ safe: true });
  });

  it('handles paths with multiple trailing slashes', () => {
    const result = validatePathForDeletion('/Users/name/projects/myproject///');

    expect(result).toEqual({ safe: true });
  });
});

// ============================================================================
// Priority and Ordering Tests
// ============================================================================

describe('Path Safety - Check Priority', () => {
  it('DANGEROUS_PATH check takes priority over TOO_SHALLOW', () => {
    // /etc is both dangerous AND has only 1 component
    // Should return DANGEROUS_PATH, not TOO_SHALLOW
    const result = validatePathForDeletion('/etc');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });

  it('TOO_SHALLOW check takes priority over INSUFFICIENT_DEPTH for non-dangerous paths', () => {
    // /foo/bar has 2 components, not dangerous
    const result = validatePathForDeletion('/foo/bar');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
    }
  });

  it('root path returns DANGEROUS_PATH not TOO_SHALLOW', () => {
    // / has 0 components, but is also a DANGEROUS_PREFIX
    const result = validatePathForDeletion('/');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('DANGEROUS_PATH');
    }
  });
});

// ============================================================================
// System Prefix Boundary Tests
// ============================================================================

describe('Path Safety - System Prefix Boundaries', () => {
  it('allows /Users2/name/project (not a dangerous prefix)', () => {
    // /Users2 is NOT in DANGEROUS_PREFIXES
    const result = validatePathForDeletion('/Users2/name/project');

    expect(result).toEqual({ safe: true });
  });

  it('allows /homestead/name/project (not /home prefix)', () => {
    // /homestead is NOT /home
    const result = validatePathForDeletion('/homestead/name/project');

    expect(result).toEqual({ safe: true });
  });

  it('allows /etcetera/config/app (not /etc prefix)', () => {
    // /etcetera is NOT /etc
    const result = validatePathForDeletion('/etcetera/config/app');

    expect(result).toEqual({ safe: true });
  });

  it('blocks /Users/a (starts with /Users, only 2 components)', () => {
    const result = validatePathForDeletion('/Users/a');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('TOO_SHALLOW');
    }
  });

  it('blocks /home/user/a (starts with /home, only 3 components)', () => {
    const result = validatePathForDeletion('/home/user/a');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('INSUFFICIENT_DEPTH');
    }
  });
});

// ============================================================================
// Real-World Scenario Tests
// ============================================================================

describe('Path Safety - Real-World Scenarios', () => {
  it('allows typical macOS project path', () => {
    const result = validatePathForDeletion('/Users/developer/Documents/Projects/my-app');

    expect(result).toEqual({ safe: true });
  });

  it('allows typical Linux project path', () => {
    const result = validatePathForDeletion('/home/developer/projects/my-app');

    expect(result).toEqual({ safe: true });
  });

  it('allows typical tmp worktree path', () => {
    const result = validatePathForDeletion('/tmp/agentpane/worktrees/abc123');

    expect(result).toEqual({ safe: true });
  });

  it('blocks accidentally targeting user home directory', () => {
    const result = validatePathForDeletion('/Users/developer');

    expect(result.safe).toBe(false);
  });

  it('blocks accidentally targeting Documents folder', () => {
    const result = validatePathForDeletion('/Users/developer/Documents');

    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.code).toBe('INSUFFICIENT_DEPTH');
    }
  });

  it('allows Docker container paths', () => {
    const result = validatePathForDeletion('/var/lib/docker/containers/abc123/data');

    expect(result).toEqual({ safe: true });
  });

  it('blocks system config directory', () => {
    const result = validatePathForDeletion('/etc/nginx');

    expect(result.safe).toBe(false);
  });

  it('blocks system log directory', () => {
    const result = validatePathForDeletion('/var/log');

    expect(result.safe).toBe(false);
  });
});
