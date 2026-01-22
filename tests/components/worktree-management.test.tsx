import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorktreeManagement } from '@/app/components/features/worktree-management';
import { apiClient } from '@/lib/api/client';

// Mock the API client
vi.mock('@/lib/api/client', () => ({
  apiClient: {
    worktrees: {
      list: vi.fn(),
      getDiff: vi.fn(),
      remove: vi.fn(),
      commit: vi.fn(),
      merge: vi.fn(),
      prune: vi.fn(),
    },
  },
}));

// Mock toast
vi.mock('@/app/components/ui/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const mockWorktrees = [
  {
    id: 'worktree-1',
    branch: 'agent/abc123/feature-auth',
    path: '.worktrees/agent-abc123-feature-auth',
    baseBranch: 'main',
    status: 'active',
    taskId: 'task-1',
    taskTitle: 'Implement authentication',
    agentId: 'agent-1',
    agentName: 'TaskBot',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasUncommittedChanges: false,
    aheadBehind: { ahead: 2, behind: 0 },
  },
  {
    id: 'worktree-2',
    branch: 'agent/def456/feature-ui',
    path: '.worktrees/agent-def456-feature-ui',
    baseBranch: 'main',
    status: 'active',
    taskId: 'task-2',
    taskTitle: 'Update UI components',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    hasUncommittedChanges: true,
  },
];

describe('WorktreeManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiClient.worktrees.list).mockResolvedValue({
      ok: true,
      data: { items: mockWorktrees, totalCount: 2 },
    });
    vi.mocked(apiClient.worktrees.getDiff).mockResolvedValue({
      ok: true,
      data: { files: [], stats: { filesChanged: 0, additions: 0, deletions: 0 } },
    });
    vi.mocked(apiClient.worktrees.remove).mockResolvedValue({
      ok: true,
      data: { success: true },
    });
  });

  it('renders worktree list after loading', async () => {
    render(<WorktreeManagement projectId="project-1" />);

    // Initially shows loading
    await waitFor(() => {
      expect(screen.getByText('Worktrees')).toBeInTheDocument();
    });

    // After loading, shows worktrees
    await waitFor(() => {
      expect(screen.getByText(/feature-auth/)).toBeInTheDocument();
      expect(screen.getByText(/feature-ui/)).toBeInTheDocument();
    });
  });

  it('renders empty state when no worktrees', async () => {
    vi.mocked(apiClient.worktrees.list).mockResolvedValue({
      ok: true,
      data: { items: [], totalCount: 0 },
    });

    render(<WorktreeManagement projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('No worktrees yet')).toBeInTheDocument();
    });
  });

  it('shows error state on API failure', async () => {
    vi.mocked(apiClient.worktrees.list).mockResolvedValue({
      ok: false,
      error: { code: 'ERROR', message: 'Failed to fetch worktrees' },
    });

    render(<WorktreeManagement projectId="project-1" />);

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch worktrees')).toBeInTheDocument();
    });
  });

  it('opens remove dialog and removes worktree', async () => {
    const user = userEvent.setup();

    render(<WorktreeManagement projectId="project-1" />);

    // Wait for worktrees to load
    await waitFor(() => {
      expect(screen.getByText(/feature-auth/)).toBeInTheDocument();
    });

    // Find and click Remove button on first worktree
    const removeButtons = await screen.findAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0] as HTMLElement);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByText('Remove Worktree')).toBeInTheDocument();
    });

    // Click the remove confirmation button
    const confirmButton = screen.getByRole('button', { name: 'Remove Worktree' });
    await user.click(confirmButton);

    // API should be called
    await waitFor(() => {
      expect(apiClient.worktrees.remove).toHaveBeenCalledWith('worktree-1', false);
    });
  });

  it('shows dirty status for worktrees with uncommitted changes', async () => {
    render(<WorktreeManagement projectId="project-1" />);

    await waitFor(() => {
      // Second worktree has uncommitted changes, should show "Dirty" status
      expect(screen.getByText('Dirty')).toBeInTheDocument();
    });
  });

  it('supports panel mode', async () => {
    render(<WorktreeManagement projectId="project-1" panelMode />);

    await waitFor(() => {
      // In panel mode, should show compact list
      expect(screen.getByText(/feature-auth/)).toBeInTheDocument();
    });
  });
});
