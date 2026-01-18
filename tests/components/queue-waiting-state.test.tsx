import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QueueWaitingState } from '@/app/components/features/queue-waiting-state';

describe('QueueWaitingState', () => {
  it('renders queue position and wait time', () => {
    render(<QueueWaitingState position={2} estimatedWaitMinutes={6} />);

    expect(screen.getByText('Queued for an agent')).toBeInTheDocument();
    expect(screen.getByTestId('queue-position-number')).toHaveTextContent('2');
    expect(screen.getByTestId('estimated-wait')).toHaveTextContent('Estimated wait 6 min');
  });

  it('renders unknown wait time', () => {
    render(<QueueWaitingState position={1} />);

    expect(screen.getByText('Queued for an agent')).toBeInTheDocument();
    expect(screen.getByTestId('queue-position-number')).toHaveTextContent('1');
    expect(screen.queryByTestId('estimated-wait')).not.toBeInTheDocument();
  });
});
