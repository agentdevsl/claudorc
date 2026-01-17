import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GitHubAppSetup } from '@/app/components/features/github-app-setup';

describe('GitHubAppSetup', () => {
  it('renders connected state with repo', () => {
    const onConnect = vi.fn();
    render(<GitHubAppSetup connected={true} repo="agentpane/core" onConnect={onConnect} />);

    expect(screen.getByText('GitHub connection')).toBeInTheDocument();
    expect(screen.getByText('Connected to agentpane/core')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Manage connection/i })).toBeInTheDocument();
  });

  it('renders connected state without repo', () => {
    const onConnect = vi.fn();
    render(<GitHubAppSetup connected={true} onConnect={onConnect} />);

    expect(screen.getByText('Connected to repository')).toBeInTheDocument();
  });

  it('renders disconnected state', () => {
    const onConnect = vi.fn();
    render(<GitHubAppSetup connected={false} onConnect={onConnect} />);

    expect(screen.getByText('GitHub connection')).toBeInTheDocument();
    expect(
      screen.getByText('Connect GitHub to enable sync and PR automation.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect GitHub/i })).toBeInTheDocument();
  });

  it('calls onConnect when button clicked', () => {
    const onConnect = vi.fn();
    render(<GitHubAppSetup connected={false} onConnect={onConnect} />);

    fireEvent.click(screen.getByRole('button', { name: /Connect GitHub/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('calls onConnect when manage button clicked in connected state', () => {
    const onConnect = vi.fn();
    render(<GitHubAppSetup connected={true} repo="agentpane/core" onConnect={onConnect} />);

    fireEvent.click(screen.getByRole('button', { name: /Manage connection/i }));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });
});
