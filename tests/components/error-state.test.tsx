import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from '@/app/components/features/error-state';

describe('ErrorState', () => {
  it('renders default title and description', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('Try again or check your connection.')).toBeInTheDocument();
  });

  it('renders custom title and description', () => {
    render(<ErrorState title="Network Error" description="Unable to connect to the server." />);

    expect(screen.getByText('Network Error')).toBeInTheDocument();
    expect(screen.getByText('Unable to connect to the server.')).toBeInTheDocument();
  });

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not show retry button when onRetry not provided', () => {
    render(<ErrorState />);

    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
