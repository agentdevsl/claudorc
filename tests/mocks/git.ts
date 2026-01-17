import { vi } from 'vitest';

export type GitCommandResult = {
  stdout: string;
  stderr: string;
};

export type MockGitCommands = {
  status: ReturnType<typeof vi.fn>;
  add: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  push: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  checkout: ReturnType<typeof vi.fn>;
  branch: ReturnType<typeof vi.fn>;
  merge: ReturnType<typeof vi.fn>;
  diff: ReturnType<typeof vi.fn>;
  log: ReturnType<typeof vi.fn>;
  revParse: ReturnType<typeof vi.fn>;
  worktreeAdd: ReturnType<typeof vi.fn>;
  worktreeRemove: ReturnType<typeof vi.fn>;
  worktreeList: ReturnType<typeof vi.fn>;
  remote: ReturnType<typeof vi.fn>;
  fetch: ReturnType<typeof vi.fn>;
  symbolicRef: ReturnType<typeof vi.fn>;
};

const createCommandMock = (value: GitCommandResult) => vi.fn(async () => value);

export const mockGitCommands: MockGitCommands = {
  status: createCommandMock({ stdout: '', stderr: '' }),
  add: createCommandMock({ stdout: '', stderr: '' }),
  commit: createCommandMock({ stdout: 'abc123', stderr: '' }),
  push: createCommandMock({ stdout: '', stderr: '' }),
  pull: createCommandMock({ stdout: '', stderr: '' }),
  checkout: createCommandMock({ stdout: '', stderr: '' }),
  branch: createCommandMock({ stdout: '', stderr: '' }),
  merge: createCommandMock({ stdout: '', stderr: '' }),
  diff: createCommandMock({ stdout: '', stderr: '' }),
  log: createCommandMock({ stdout: '', stderr: '' }),
  revParse: createCommandMock({ stdout: 'abc123', stderr: '' }),
  worktreeAdd: createCommandMock({ stdout: '', stderr: '' }),
  worktreeRemove: createCommandMock({ stdout: '', stderr: '' }),
  worktreeList: createCommandMock({ stdout: '', stderr: '' }),
  remote: createCommandMock({ stdout: '', stderr: '' }),
  fetch: createCommandMock({ stdout: '', stderr: '' }),
  symbolicRef: createCommandMock({ stdout: '', stderr: '' }),
};

const runCommand = (name: keyof MockGitCommands): Promise<GitCommandResult> => {
  const fn = mockGitCommands[name] as unknown as () => Promise<GitCommandResult>;
  return fn();
};

vi.mock('bun', () => ({
  $: vi.fn().mockImplementation((strings: TemplateStringsArray, ...values: unknown[]) => {
    const command = strings.reduce((acc, str, index) => acc + str + (values[index] ?? ''), '');

    if (command.includes('worktree add')) return runCommand('worktreeAdd');
    if (command.includes('worktree remove')) return runCommand('worktreeRemove');
    if (command.includes('worktree list')) return runCommand('worktreeList');
    if (command.includes('git diff')) return runCommand('diff');
    if (command.includes('git status')) return runCommand('status');
    if (command.includes('git add')) return runCommand('add');
    if (command.includes('git commit')) return runCommand('commit');
    if (command.includes('git merge')) return runCommand('merge');
    if (command.includes('git branch')) return runCommand('branch');
    if (command.includes('git rev-parse')) return runCommand('revParse');
    if (command.includes('git checkout')) return runCommand('checkout');
    if (command.includes('git pull')) return runCommand('pull');
    if (command.includes('git push')) return runCommand('push');
    if (command.includes('git remote')) return runCommand('remote');
    if (command.includes('git fetch')) return runCommand('fetch');
    if (command.includes('git symbolic-ref')) return runCommand('symbolicRef');

    return { stdout: '', stderr: '' };
  }),
}));
