import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueueWaitingState } from '@/app/components/features/queue-waiting-state';

describe('QueueWaitingState', () => {
  it('renders queue position and wait time', () => {
    render(<QueueWaitingState position={2} estimatedWaitMinutes={6} />);

    expect(screen.getByText('Queued for an agent')).toBeInTheDocument();
    expect(screen.getByText('Position 2 in queue')).toBeInTheDocument();
    expect(screen.getByText('Estimated wait 6 min')).toBeInTheDocument();
  });

  it('renders unknown wait time', () => {
    render(<QueueWaitingState position={1} />);

    expect(screen.getByText('Queued for an agent')).toBeInTheDocument();
    expect(screen.getByText('Position 1 in queue')).toBeInTheDocument();
    expect(screen.queryByText(/Estimated wait/i)).not.toBeInTheDocument();
  });
});
