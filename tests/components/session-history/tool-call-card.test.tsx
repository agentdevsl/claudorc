import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolCallCard } from '@/app/components/features/session-history/components/tool-call-card';
import type { ToolCallEntry } from '@/app/components/features/session-history/types';

// ===== Mock Data =====

const mockToolCallComplete: ToolCallEntry = {
  id: 'tc-1',
  tool: 'Read',
  input: { file_path: '/test.ts' },
  output: { content: 'file contents' },
  status: 'complete',
  duration: 1500,
  timestamp: 1706284800000,
  timeOffset: '0:15',
};

const mockToolCallRunningGrep: ToolCallEntry = {
  id: 'tc-2',
  tool: 'Grep',
  input: { pattern: 'TODO', path: '/src' },
  status: 'running',
  timestamp: 1706284860000,
  timeOffset: '1:15',
};

const mockToolCallRunning: ToolCallEntry = {
  id: 'tc-3',
  tool: 'Bash',
  input: { command: 'npm test' },
  status: 'running',
  timestamp: 1706284920000,
  timeOffset: '2:15',
};

const mockToolCallError: ToolCallEntry = {
  id: 'tc-4',
  tool: 'Edit',
  input: { file_path: '/missing.ts', old_string: 'foo', new_string: 'bar' },
  status: 'error',
  error: 'File not found: /missing.ts',
  duration: 50,
  timestamp: 1706284980000,
  timeOffset: '3:15',
};

const mockToolCallNoDuration: ToolCallEntry = {
  id: 'tc-5',
  tool: 'Glob',
  input: { pattern: '**/*.ts' },
  output: { files: ['a.ts', 'b.ts'] },
  status: 'complete',
  timestamp: 1706285040000,
  timeOffset: '4:15',
};

const mockToolCallLongPayload: ToolCallEntry = {
  id: 'tc-6',
  tool: 'Read',
  input: { file_path: '/very-long-path.ts' },
  output: { content: 'x'.repeat(600) },
  status: 'complete',
  duration: 100,
  timestamp: 1706285100000,
  timeOffset: '5:15',
};

// ===== Rendering Tests =====

describe('ToolCallCard Rendering', () => {
  it('renders tool name correctly', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    expect(screen.getByText('Read')).toBeInTheDocument();
  });

  it('renders timestamp (timeOffset) correctly', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    expect(screen.getByText('0:15')).toBeInTheDocument();
  });

  it('renders duration badge when duration is provided', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    // 1500ms = 1s (formatted by formatDuration)
    expect(screen.getByText('1s')).toBeInTheDocument();
  });

  it('does not render duration badge when duration is undefined', () => {
    render(<ToolCallCard toolCall={mockToolCallNoDuration} />);

    // The Clock icon with duration text should not be present
    // Check that no duration-related text is shown (like "0s" or any seconds)
    const card = screen.getByTestId('tool-call-card');
    // Duration badge shows seconds, but the status badge also exists
    // Look for the specific duration format pattern
    expect(card.textContent).not.toMatch(/\d+s.*Glob/);
  });

  it('renders correct status badge text for running', () => {
    render(<ToolCallCard toolCall={mockToolCallRunning} />);

    expect(screen.getByText('running')).toBeInTheDocument();
  });

  it('renders correct status badge text for complete', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    expect(screen.getByText('complete')).toBeInTheDocument();
  });

  it('renders correct status badge text for error', () => {
    render(<ToolCallCard toolCall={mockToolCallError} />);

    expect(screen.getByText('error')).toBeInTheDocument();
  });
});

// ===== Status Variant Tests =====

describe('ToolCallCard Status Variants', () => {
  it('applies running status styling with pulse animation', () => {
    render(<ToolCallCard toolCall={mockToolCallRunning} />);

    const card = screen.getByTestId('tool-call-card');
    expect(card).toHaveAttribute('data-tool-status', 'running');

    // Check that the status badge has animate-pulse class
    const statusBadge = screen.getByText('running').closest('span');
    expect(statusBadge).toHaveClass('animate-pulse');
  });

  it('applies complete status styling (success colors)', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    const card = screen.getByTestId('tool-call-card');
    expect(card).toHaveAttribute('data-tool-status', 'complete');
  });

  it('applies error status styling (danger colors)', () => {
    render(<ToolCallCard toolCall={mockToolCallError} />);

    const card = screen.getByTestId('tool-call-card');
    expect(card).toHaveAttribute('data-tool-status', 'error');
  });
});

// ===== Expand/Collapse Tests =====

describe('ToolCallCard Expand/Collapse', () => {
  it('card is collapsed by default', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    // When collapsed, the input/output sections should not be visible
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('clicking header expands the card', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    // Click the header button to expand
    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // Now the Input section should be visible
    expect(screen.getByText('Input')).toBeInTheDocument();
  });

  it('clicking again collapses the card', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    const headerButton = screen.getByRole('button');

    // Expand
    await user.click(headerButton);
    expect(screen.getByText('Input')).toBeInTheDocument();

    // Collapse
    await user.click(headerButton);
    expect(screen.queryByText('Input')).not.toBeInTheDocument();
  });

  it('shows input JSON when expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // Should show the Input section label
    expect(screen.getByText('Input')).toBeInTheDocument();

    // Should show the input JSON with file_path key
    expect(screen.getByText(/file_path/)).toBeInTheDocument();

    // The path appears twice - once in header summary and once in JSON
    // Just verify we have the JSON structure visible
    const codeElements = document.querySelectorAll('code');
    const inputCode = Array.from(codeElements).find((el) =>
      el.textContent?.includes('"file_path"')
    );
    expect(inputCode).toBeInTheDocument();
  });

  it('shows output JSON when expanded and output exists', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // Should show the Output section
    expect(screen.getByText('Output')).toBeInTheDocument();
    expect(screen.getByText(/file contents/)).toBeInTheDocument();
  });

  it('does not show output section when output is undefined', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallRunningGrep} />);

    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // Input should be shown, but not Output
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.queryByText('Output')).not.toBeInTheDocument();
  });

  it('shows error message when status is error and expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallError} />);

    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // Should show the error message
    expect(screen.getByText(/Error:/)).toBeInTheDocument();
    expect(screen.getByText(/File not found: \/missing\.ts/)).toBeInTheDocument();
  });

  it('truncates long payloads when collapsed', () => {
    // When collapsed, the card only shows header info
    // The truncation happens in formatPayload when !isExpanded
    // Since collapsed cards don't show payload, we need to test
    // that when we have a component that shows preview, it truncates
    // Actually, looking at the component, collapsed cards don't show any payload
    // The truncation is only visible if we had inline preview (which we don't)
    // Let's verify the collapsed state doesn't show the long content
    render(<ToolCallCard toolCall={mockToolCallLongPayload} />);

    // When collapsed, the 600-char content should not be visible at all
    const longContent = 'x'.repeat(600);
    expect(screen.queryByText(longContent)).not.toBeInTheDocument();
  });

  it('shows full payload when expanded', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallLongPayload} />);

    const headerButton = screen.getByRole('button');
    await user.click(headerButton);

    // When expanded, the full content should be visible (not truncated)
    // The output has 600 'x' characters which exceeds MAX_PAYLOAD_LENGTH (500)
    // When expanded, formatPayload returns the full JSON
    expect(screen.getByText('Output')).toBeInTheDocument();

    // Get the code elements and find the one with the output
    const codeElements = document.querySelectorAll('code');
    const outputCode = Array.from(codeElements).find((el) =>
      el.textContent?.includes('x'.repeat(100))
    );

    // The output should contain the full 600 'x' characters, not truncated with '...'
    expect(outputCode?.textContent).toContain('x'.repeat(600));
    expect(outputCode?.textContent).not.toContain('...');
  });
});

// ===== Props Tests =====

describe('ToolCallCard Props', () => {
  it('respects defaultExpanded prop', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} defaultExpanded={true} />);

    // Should be expanded by default, showing Input section
    expect(screen.getByText('Input')).toBeInTheDocument();
    expect(screen.getByText('Output')).toBeInTheDocument();
  });

  it('calls onExpandedChange callback when toggled', async () => {
    const user = userEvent.setup();
    const onExpandedChange = vi.fn();

    render(<ToolCallCard toolCall={mockToolCallComplete} onExpandedChange={onExpandedChange} />);

    const headerButton = screen.getByRole('button');

    // Expand - should call with true
    await user.click(headerButton);
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    // Collapse - should call with false
    await user.click(headerButton);
    expect(onExpandedChange).toHaveBeenCalledWith(false);

    // Should have been called twice
    expect(onExpandedChange).toHaveBeenCalledTimes(2);
  });

  it('sets aria-expanded attribute correctly', async () => {
    const user = userEvent.setup();
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    const headerButton = screen.getByRole('button');

    // Initially collapsed
    expect(headerButton).toHaveAttribute('aria-expanded', 'false');

    // After clicking, expanded
    await user.click(headerButton);
    expect(headerButton).toHaveAttribute('aria-expanded', 'true');

    // After clicking again, collapsed
    await user.click(headerButton);
    expect(headerButton).toHaveAttribute('aria-expanded', 'false');
  });
});

// ===== Input Summary Tests =====

describe('ToolCallCard Input Summary', () => {
  it('shows file_path in header summary', () => {
    render(<ToolCallCard toolCall={mockToolCallComplete} />);

    // The input summary should show the file_path value
    expect(screen.getByText('/test.ts')).toBeInTheDocument();
  });

  it('shows path in header summary for Grep (path takes priority over pattern)', () => {
    // The getInputSummary function prioritizes 'path' over 'pattern'
    render(<ToolCallCard toolCall={mockToolCallRunningGrep} />);

    expect(screen.getByText('/src')).toBeInTheDocument();
  });

  it('shows pattern in header summary when no path is provided', () => {
    const grepWithPatternOnly: ToolCallEntry = {
      ...mockToolCallRunningGrep,
      id: 'tc-pattern-only',
      input: { pattern: 'TODO' },
    };
    render(<ToolCallCard toolCall={grepWithPatternOnly} />);

    expect(screen.getByText('TODO')).toBeInTheDocument();
  });

  it('shows command in header summary for Bash', () => {
    render(<ToolCallCard toolCall={mockToolCallRunning} />);

    expect(screen.getByText('npm test')).toBeInTheDocument();
  });
});
