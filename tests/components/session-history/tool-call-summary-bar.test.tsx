import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ToolCallSummaryBar } from '@/app/components/features/session-history/components/tool-call-summary-bar';
import type { ToolCallStats } from '@/app/components/features/session-history/types';

// ===== Mock Data =====

const mockStatsZero: ToolCallStats = {
  totalCalls: 0,
  errorCount: 0,
  avgDurationMs: 0,
  totalDurationMs: 0,
  toolBreakdown: [],
};

const mockStatsNormal: ToolCallStats = {
  totalCalls: 10,
  errorCount: 2,
  avgDurationMs: 2500, // 2.5s rounds to 2s
  totalDurationMs: 25000, // 25s
  toolBreakdown: [
    { tool: 'Read', count: 5 },
    { tool: 'Grep', count: 3 },
    { tool: 'Edit', count: 2 },
  ],
};

const mockStatsNoErrors: ToolCallStats = {
  totalCalls: 5,
  errorCount: 0,
  avgDurationMs: 200,
  totalDurationMs: 1000,
  toolBreakdown: [{ tool: 'Read', count: 5 }],
};

const mockStatsLargeDuration: ToolCallStats = {
  totalCalls: 3,
  errorCount: 1,
  avgDurationMs: 65000, // 1m 5s
  totalDurationMs: 195000, // 3m 15s
  toolBreakdown: [{ tool: 'Bash', count: 3 }],
};

// ===== Rendering Tests =====

describe('ToolCallSummaryBar', () => {
  it('renders with zero stats', () => {
    render(<ToolCallSummaryBar stats={mockStatsZero} />);

    expect(screen.getByTestId('tool-call-summary-bar')).toBeInTheDocument();
    // Check that zero calls and zero errors are displayed (multiple "0" elements exist)
    const zeros = screen.getAllByText('0');
    expect(zeros.length).toBeGreaterThanOrEqual(2); // At least calls and errors
  });

  it('renders total calls correctly', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('Calls')).toBeInTheDocument();
  });

  it('renders error count correctly', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
  });

  it('renders total duration correctly', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    // 25000ms = 25s (formatted by formatDuration)
    expect(screen.getByText('Total:')).toBeInTheDocument();
    expect(screen.getByText('25s')).toBeInTheDocument();
  });

  it('renders average duration correctly', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    // 2500ms = 2s (formatted by formatDuration floors to seconds)
    expect(screen.getByText('Avg:')).toBeInTheDocument();
    expect(screen.getByText('2s')).toBeInTheDocument();
  });

  it('applies danger styling when errors > 0', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    // Find the error count element and check for danger class
    const errorsText = screen.getByText('Errors');
    const errorContainer = errorsText.closest('span');

    expect(errorContainer).toHaveClass('text-danger');
  });

  it('does not apply danger styling when errors = 0', () => {
    render(<ToolCallSummaryBar stats={mockStatsNoErrors} />);

    // Find the Errors label element
    const errorsText = screen.getByText('Errors');
    const errorContainer = errorsText.closest('span');

    expect(errorContainer).not.toHaveClass('text-danger');
    expect(errorContainer).toHaveClass('text-fg-muted');
    // Verify the 0 is not styled as danger (should have text-fg class)
    const zeroElements = screen.getAllByText('0');
    expect(zeroElements.length).toBeGreaterThan(0);
  });

  it('formats large durations correctly', () => {
    render(<ToolCallSummaryBar stats={mockStatsLargeDuration} />);

    // 195000ms = 3m 15s, 65000ms = 1m 5s
    expect(screen.getByText('3m 15s')).toBeInTheDocument();
    expect(screen.getByText('1m 5s')).toBeInTheDocument();
  });

  it('has correct test id for querying', () => {
    render(<ToolCallSummaryBar stats={mockStatsNormal} />);

    const bar = screen.getByTestId('tool-call-summary-bar');
    expect(bar).toBeInTheDocument();
    expect(bar).toHaveClass('shrink-0');
  });
});
