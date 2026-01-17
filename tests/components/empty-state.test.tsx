import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '@/app/components/features/empty-state';

describe('EmptyState', () => {
  it('renders preset content', () => {
    render(<EmptyState preset="no-projects" />);

    expect(screen.getByText('No projects yet')).toBeInTheDocument();
    expect(screen.getByText('Create a project to start managing tasks')).toBeInTheDocument();
  });

  it('renders custom title and subtitle', () => {
    render(<EmptyState title="Custom Title" subtitle="Custom subtitle text" />);

    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.getByText('Custom subtitle text')).toBeInTheDocument();
  });

  it('renders action button', () => {
    const onClick = vi.fn();
    render(<EmptyState preset="no-tasks" action={{ label: 'Add Task', onClick }} />);

    expect(screen.getByRole('button', { name: 'Add Task' })).toBeInTheDocument();
  });

  it('calls onClick when action button clicked', () => {
    const onClick = vi.fn();
    render(<EmptyState preset="no-tasks" action={{ label: 'Add Task', onClick }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Add Task' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
