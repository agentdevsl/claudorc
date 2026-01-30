/**
 * Tests for git command runner mocks
 *
 * Verifies that mock builders produce correct responses for common git commands.
 */

import { describe, expect, it } from 'vitest';
import {
  createMockCommandRunner,
  createMockGitDiff,
  createMockGitDiffOutput,
  createMockGitRunner,
  createMockGitRunnerWithBranch,
  createMockGitRunnerWithConflict,
  createMockGitRunnerWithWorktrees,
  createMockWorktreeListOutput,
} from './mock-git';

describe('mock-git', () => {
  describe('createMockCommandRunner', () => {
    it('returns configured responses for matching commands', async () => {
      const runner = createMockCommandRunner({
        'git status': { stdout: 'On branch main', stderr: '' },
        'git branch': { stdout: '* main', stderr: '' },
      });

      const status = await runner.exec('git status', '/project');
      expect(status.stdout).toBe('On branch main');

      const branch = await runner.exec('git branch', '/project');
      expect(branch.stdout).toBe('* main');
    });

    it('supports function-based responses', async () => {
      const runner = createMockCommandRunner({
        'git rev-parse': (_cmd, cwd) => ({ stdout: cwd, stderr: '' }),
      });

      const result = await runner.exec('git rev-parse --show-toplevel', '/home/user/project');
      expect(result.stdout).toBe('/home/user/project');
    });

    it('returns empty output for unmatched commands', async () => {
      const runner = createMockCommandRunner({});

      const result = await runner.exec('git unknown-command', '/project');
      expect(result.stdout).toBe('');
      expect(result.stderr).toBe('');
    });
  });

  describe('createMockGitRunner', () => {
    it('provides sensible git defaults', async () => {
      const runner = createMockGitRunner('/home/user/project');

      const root = await runner.exec('git rev-parse --show-toplevel', '/anywhere');
      expect(root.stdout).toBe('/home/user/project');

      const branch = await runner.exec('git rev-parse --abbrev-ref HEAD', '/anywhere');
      expect(branch.stdout).toBe('main');

      const branchList = await runner.exec('git branch --list "feature"', '/anywhere');
      expect(branchList.stdout).toBe(''); // Branch doesn't exist by default
    });

    it('supports worktree commands', async () => {
      const runner = createMockGitRunner();

      const add = await runner.exec(
        'git worktree add .worktrees/feature -b feature main',
        '/project'
      );
      expect(add.stdout).toContain('Preparing worktree');

      const remove = await runner.exec('git worktree remove .worktrees/feature', '/project');
      expect(remove.stdout).toBe('');
    });

    it('supports diff commands', async () => {
      const runner = createMockGitRunner();

      const stat = await runner.exec('git diff --stat main', '/project');
      expect(stat.stdout).toContain('file changed');

      const diff = await runner.exec('git diff main', '/project');
      expect(diff.stdout).toContain('diff --git');
    });
  });

  describe('createMockGitRunnerWithBranch', () => {
    it('returns existing branch from branch --list', async () => {
      const runner = createMockGitRunnerWithBranch('feature-abc123');

      const result = await runner.exec('git branch --list "feature-abc123"', '/project');
      expect(result.stdout).toBe('  feature-abc123');
    });
  });

  describe('createMockGitRunnerWithWorktrees', () => {
    it('returns porcelain-formatted worktree list', async () => {
      const runner = createMockGitRunnerWithWorktrees([
        { path: '/project', branch: 'main', head: 'abc123' },
        { path: '/project/.worktrees/feature', branch: 'feature', head: 'def456' },
      ]);

      const result = await runner.exec('git worktree list --porcelain', '/project');
      expect(result.stdout).toContain('worktree /project');
      expect(result.stdout).toContain('branch refs/heads/main');
      expect(result.stdout).toContain('worktree /project/.worktrees/feature');
      expect(result.stdout).toContain('branch refs/heads/feature');
    });
  });

  describe('createMockGitRunnerWithConflict', () => {
    it('throws error on merge command', async () => {
      const runner = createMockGitRunnerWithConflict();

      await expect(runner.exec('git merge feature', '/project')).rejects.toThrow('CONFLICT');
    });

    it('returns conflicted files from diff --name-only', async () => {
      const runner = createMockGitRunnerWithConflict();

      const result = await runner.exec('git diff --name-only --diff-filter=U', '/project');
      expect(result.stdout).toContain('README.md');
      expect(result.stdout).toContain('src/index.ts');
    });
  });

  describe('createMockGitDiff', () => {
    it('generates realistic diff stat output', () => {
      const diff = createMockGitDiff([
        { path: 'README.md', additions: 10, deletions: 2 },
        { path: 'src/index.ts', additions: 5, deletions: 3 },
      ]);

      expect(diff).toContain('README.md');
      expect(diff).toContain('src/index.ts');
      expect(diff).toContain('2 files changed');
      expect(diff).toContain('15 insertions(+)');
      expect(diff).toContain('5 deletions(-)');
    });

    it('handles single file changes', () => {
      const diff = createMockGitDiff([{ path: 'test.txt', additions: 3, deletions: 1 }]);

      expect(diff).toContain('1 file changed');
      expect(diff).toContain('3 insertions(+)');
      expect(diff).toContain('1 deletions(-)');
    });
  });

  describe('createMockGitDiffOutput', () => {
    it('generates unified diff format', () => {
      const diff = createMockGitDiffOutput([{ path: 'README.md', additions: 2, deletions: 1 }]);

      expect(diff).toContain('diff --git a/README.md b/README.md');
      expect(diff).toContain('--- a/README.md');
      expect(diff).toContain('+++ b/README.md');
      expect(diff).toContain('@@');
      expect(diff).toContain('+added line');
      expect(diff).toContain('-deleted line');
    });

    it('handles added files', () => {
      const diff = createMockGitDiffOutput([
        { path: 'new-file.txt', additions: 5, deletions: 0, status: 'added' },
      ]);

      expect(diff).toContain('new file mode 100644');
      expect(diff).toContain('--- /dev/null');
      expect(diff).toContain('+++ b/new-file.txt');
    });

    it('handles deleted files', () => {
      const diff = createMockGitDiffOutput([
        { path: 'old-file.txt', additions: 0, deletions: 5, status: 'deleted' },
      ]);

      expect(diff).toContain('deleted file mode 100644');
      expect(diff).toContain('--- a/old-file.txt');
      expect(diff).toContain('+++ /dev/null');
    });
  });

  describe('createMockWorktreeListOutput', () => {
    it('generates porcelain format with single worktree', () => {
      const output = createMockWorktreeListOutput([
        { path: '/project', branch: 'main', head: 'abc123' },
      ]);

      expect(output).toContain('worktree /project');
      expect(output).toContain('HEAD abc123');
      expect(output).toContain('branch refs/heads/main');
    });

    it('generates porcelain format with multiple worktrees', () => {
      const output = createMockWorktreeListOutput([
        { path: '/project', branch: 'main', head: 'abc123' },
        { path: '/project/.worktrees/feature', branch: 'feature', head: 'def456' },
      ]);

      const blocks = output.split('\n\n');
      expect(blocks).toHaveLength(2);
      expect(blocks[0]).toContain('worktree /project');
      expect(blocks[1]).toContain('worktree /project/.worktrees/feature');
    });

    it('handles detached HEAD', () => {
      const output = createMockWorktreeListOutput([
        { path: '/project', branch: '', head: 'abc123', detached: true },
      ]);

      expect(output).toContain('detached');
      expect(output).not.toContain('branch refs/heads/');
    });

    it('handles bare repository', () => {
      const output = createMockWorktreeListOutput([
        { path: '/project', branch: 'main', head: 'abc123', bare: true },
      ]);

      expect(output).toContain('bare');
    });

    it('handles prunable worktrees', () => {
      const output = createMockWorktreeListOutput([
        {
          path: '/project/.worktrees/stale',
          branch: 'stale',
          head: 'abc123',
          prunable: 'gitdir file points to non-existent location',
        },
      ]);

      expect(output).toContain('prunable gitdir file points to non-existent location');
    });
  });
});
