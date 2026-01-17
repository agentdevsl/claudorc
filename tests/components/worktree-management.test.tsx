import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorktreeManagement } from '@/app/components/features/worktree-management';
import type { WorktreeStatusInfo } from '@/services/worktree.service';

describe('WorktreeManagement', () => {
  it('renders worktree list and calls remove', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const worktrees: WorktreeStatusInfo[] = [
      {
        id: 'worktree-1',
        branch: 'feature/auth',
        path: '.worktrees/feature-auth',
        status: 'active',
      },
      {
        id: 'worktree-2',
        branch: 'feature/ui',
        path: '.worktrees/feature-ui',
        status: 'error',
      },
    ];

    render(<WorktreeManagement worktrees={worktrees} onRemove={onRemove} />);

    expect(screen.getByText('Worktrees')).toBeInTheDocument();
    expect(screen.getByText('feature/auth')).toBeInTheDocument();
    expect(screen.getByText('feature/ui')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();

    const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
    await user.click(removeButtons[0] as HTMLElement);

    expect(onRemove).toHaveBeenCalledWith('worktree-1');
  });

  it('renders empty state message', () => {
    render(<WorktreeManagement worktrees={[]} onRemove={vi.fn()} />);

    expect(screen.getByText('No worktrees yet.')).toBeInTheDocument();
  });
});
