import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GitHubAppSetup } from '@/app/components/features/github-app-setup';
import { ServiceProvider } from '@/app/services/service-context';
import type { Services } from '@/app/services/services';
import { ok } from '@/lib/utils/result';
import type { TokenInfo } from '@/services/github-token.service';

// Helper to create mock services with a specific github token service
function createMockServices(githubTokenService: Partial<Services['githubTokenService']>): Services {
  return {
    githubTokenService: {
      getTokenInfo: vi.fn().mockResolvedValue(ok(null)),
      saveToken: vi.fn().mockResolvedValue(ok(null)),
      deleteToken: vi.fn().mockResolvedValue(ok(undefined)),
      revalidateToken: vi.fn().mockResolvedValue(ok(true)),
      ...githubTokenService,
    },
  } as unknown as Services;
}

// Helper to render with service provider
function renderWithServices(ui: React.ReactElement, services: Services): ReturnType<typeof render> {
  return render(<ServiceProvider services={services}>{ui}</ServiceProvider>);
}

describe('GitHubAppSetup', () => {
  it('renders connected state with valid token', async () => {
    const tokenInfo: TokenInfo = {
      id: 'token-1',
      maskedToken: 'ghp_****xxxx',
      githubLogin: 'testuser',
      isValid: true,
      lastValidatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const services = createMockServices({
      getTokenInfo: vi.fn().mockResolvedValue(ok(tokenInfo)),
    });

    renderWithServices(<GitHubAppSetup />, services);

    await waitFor(() => {
      expect(screen.getByText('GitHub Connection')).toBeInTheDocument();
    });
    expect(screen.getByText('Connected as @testuser')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
  });

  it('renders connected state with invalid token', async () => {
    const tokenInfo: TokenInfo = {
      id: 'token-1',
      maskedToken: 'ghp_****xxxx',
      githubLogin: 'testuser',
      isValid: false,
      lastValidatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const services = createMockServices({
      getTokenInfo: vi.fn().mockResolvedValue(ok(tokenInfo)),
    });

    renderWithServices(<GitHubAppSetup />, services);

    await waitFor(() => {
      expect(screen.getByText('GitHub Connection')).toBeInTheDocument();
    });
    expect(screen.getByText('Connected as @testuser')).toBeInTheDocument();
    expect(screen.getByText('Invalid')).toBeInTheDocument();
  });

  it('renders disconnected state', async () => {
    const services = createMockServices({
      getTokenInfo: vi.fn().mockResolvedValue(ok(null)),
    });

    renderWithServices(<GitHubAppSetup />, services);

    await waitFor(() => {
      expect(screen.getByText('GitHub Connection')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Connect with a Personal Access Token to enable GitHub features.')
    ).toBeInTheDocument();
    expect(screen.getByTestId('connect-github-button')).toBeInTheDocument();
  });

  it('saves token when form submitted', async () => {
    const savedTokenInfo: TokenInfo = {
      id: 'token-1',
      maskedToken: 'ghp_****xxxx',
      githubLogin: 'newuser',
      isValid: true,
      lastValidatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const saveToken = vi.fn().mockResolvedValue(ok(savedTokenInfo));
    const onTokenSaved = vi.fn();
    const services = createMockServices({
      getTokenInfo: vi.fn().mockResolvedValue(ok(null)),
      saveToken,
    });

    renderWithServices(<GitHubAppSetup onTokenSaved={onTokenSaved} />, services);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('ghp_xxxx or github_pat_xxxx')).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText('ghp_xxxx or github_pat_xxxx');
    fireEvent.change(input, { target: { value: 'ghp_testtoken123' } });

    fireEvent.click(screen.getByTestId('connect-github-button'));

    await waitFor(() => {
      expect(saveToken).toHaveBeenCalledWith('ghp_testtoken123');
    });
    expect(onTokenSaved).toHaveBeenCalled();
  });

  it('deletes token when delete button clicked', async () => {
    const tokenInfo: TokenInfo = {
      id: 'token-1',
      maskedToken: 'ghp_****xxxx',
      githubLogin: 'testuser',
      isValid: true,
      lastValidatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    const deleteToken = vi.fn().mockResolvedValue(ok(undefined));
    const services = createMockServices({
      getTokenInfo: vi.fn().mockResolvedValue(ok(tokenInfo)),
      deleteToken,
    });

    renderWithServices(<GitHubAppSetup />, services);

    await waitFor(() => {
      expect(screen.getByText('Connected as @testuser')).toBeInTheDocument();
    });

    // Find the delete button (button with trash icon)
    // Filter to find the one with className containing 'text-danger'
    const buttons = screen.getAllByRole('button');
    const trashButton = buttons.find((btn) => btn.className.includes('text-danger'));
    expect(trashButton).toBeDefined();
    if (trashButton) {
      fireEvent.click(trashButton);
    }

    await waitFor(() => {
      expect(deleteToken).toHaveBeenCalled();
    });
  });
});
