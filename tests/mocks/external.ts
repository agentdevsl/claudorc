import { vi } from 'vitest';

export const mockClaudeSDK = {
  query: vi.fn().mockImplementation(async function* () {
    yield { type: 'text', content: 'Test response' };
    yield { type: 'tool_use', tool: 'Read', input: { file: 'test.ts' } };
    yield { type: 'tool_result', id: '1', output: 'file contents' };
    yield { type: 'done' };
  }),
};

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: mockClaudeSDK.query,
}));

export const mockDurableStreams = {
  connect: vi.fn().mockResolvedValue({
    publish: vi.fn().mockResolvedValue(1), // Returns offset
    subscribe: vi.fn().mockReturnValue((async function* () {})()),
    close: vi.fn(),
  }),
};

vi.mock('@durable-streams/client', () => ({
  DurableStreamsClient: vi.fn().mockImplementation(() => mockDurableStreams),
}));

export const mockOctokit = {
  rest: {
    repos: {
      get: vi.fn().mockResolvedValue({ data: { name: 'test-repo' } }),
      getContent: vi.fn().mockResolvedValue({ data: { content: btoa('{}') } }),
    },
    pulls: {
      create: vi.fn().mockResolvedValue({
        data: { number: 1, html_url: 'https://github.com/test/pr/1' },
      }),
    },
  },
};

vi.mock('octokit', () => ({
  Octokit: vi.fn().mockImplementation(() => mockOctokit),
}));
