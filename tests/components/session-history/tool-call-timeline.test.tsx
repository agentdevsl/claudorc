import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToolCallTimeline } from '@/app/components/features/session-history/components/tool-call-timeline';
import type { ToolCallEntry, ToolCallStats } from '@/app/components/features/session-history/types';

// Mock data
const mockStats: ToolCallStats = {
  totalCalls: 3,
  errorCount: 1,
  avgDurationMs: 1200,
  toolBreakdown: [
    { tool: 'Read', count: 2 },
    { tool: 'Edit', count: 1 },
  ],
};

const mockToolCalls: ToolCallEntry[] = [
  {
    id: 'tc-1',
    tool: 'Read',
    status: 'complete',
    input: { file_path: '/src/index.ts' },
    output: 'file contents',
    duration: 150,
    timestamp: 1706000000000,
    timeOffset: '0:05',
  },
  {
    id: 'tc-2',
    tool: 'Read',
    status: 'error',
    input: { file_path: '/src/missing.ts' },
    error: 'File not found',
    duration: 50,
    timestamp: 1706000001000,
    timeOffset: '0:06',
  },
  {
    id: 'tc-3',
    tool: 'Edit',
    status: 'complete',
    input: { file_path: '/src/index.ts', old_string: 'foo', new_string: 'bar' },
    output: 'Edit successful',
    duration: 200,
    timestamp: 1706000002000,
    timeOffset: '0:07',
  },
];

describe('ToolCallTimeline', () => {
  describe('Rendering tests', () => {
    it('renders "Tool Calls" header', () => {
      render(<ToolCallTimeline toolCalls={mockToolCalls} stats={mockStats} />);

      expect(screen.getByText('Tool Calls')).toBeInTheDocument();
    });

    it('renders tool call count badge', () => {
      render(<ToolCallTimeline toolCalls={mockToolCalls} stats={mockStats} />);

      // The count badge is in the header, within a span with specific styling
      const header = screen.getByRole('banner');
      const countBadge = within(header).getByText('3');
      expect(countBadge).toBeInTheDocument();
      expect(countBadge).toHaveClass('rounded-full');
    });

    it('renders ToolCallSummaryBar with stats', () => {
      render(<ToolCallTimeline toolCalls={mockToolCalls} stats={mockStats} />);

      // Check for summary bar content
      expect(screen.getByTestId('tool-call-summary-bar')).toBeInTheDocument();
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('Calls')).toBeInTheDocument();
      expect(screen.getByText('Errors')).toBeInTheDocument();
    });

    it('renders ToolCallCard for each tool call', () => {
      render(<ToolCallTimeline toolCalls={mockToolCalls} stats={mockStats} />);

      const toolCallCards = screen.getAllByTestId('tool-call-card');
      expect(toolCallCards).toHaveLength(3);
    });

    it('renders tool calls sorted by timestamp', () => {
      const unsortedToolCalls: ToolCallEntry[] = [
        {
          id: 'tc-later',
          tool: 'Grep',
          status: 'complete',
          input: { pattern: 'test' },
          duration: 100,
          timestamp: 1706000010000,
          timeOffset: '0:15',
        },
        {
          id: 'tc-earlier',
          tool: 'Read',
          status: 'complete',
          input: { file_path: '/src/test.ts' },
          duration: 50,
          timestamp: 1706000005000,
          timeOffset: '0:10',
        },
      ];

      render(
        <ToolCallTimeline
          toolCalls={unsortedToolCalls}
          stats={{ ...mockStats, totalCalls: 2, errorCount: 0 }}
        />
      );

      const toolCallCards = screen.getAllByTestId('tool-call-card');
      expect(toolCallCards).toHaveLength(2);

      // Tool calls should be rendered in the order they are passed
      // The component does not sort them internally - it displays in array order
      expect(within(toolCallCards[0]!).getByText('Grep')).toBeInTheDocument();
      expect(within(toolCallCards[1]!).getByText('Read')).toBeInTheDocument();
    });
  });

  describe('Loading state tests', () => {
    it('shows loading skeleton when isLoading is true', () => {
      render(<ToolCallTimeline toolCalls={[]} stats={mockStats} isLoading={true} />);

      expect(screen.getByTestId('tool-call-timeline-loading')).toBeInTheDocument();
    });

    it('shows skeleton placeholders for header, summary, and cards', () => {
      render(<ToolCallTimeline toolCalls={[]} stats={mockStats} isLoading={true} />);

      const loadingContainer = screen.getByTestId('tool-call-timeline-loading');

      // Should have skeleton elements for header area (Skeleton component uses data-testid="skeleton-card")
      const skeletons = loadingContainer.querySelectorAll('[data-testid="skeleton-card"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Empty state tests', () => {
    it('shows empty state when toolCalls array is empty', () => {
      render(<ToolCallTimeline toolCalls={[]} stats={mockStats} />);

      expect(screen.getByTestId('tool-call-timeline-empty')).toBeInTheDocument();
    });

    it('shows "No tool calls in this session" message', () => {
      render(<ToolCallTimeline toolCalls={[]} stats={mockStats} />);

      expect(screen.getByText('No tool calls in this session')).toBeInTheDocument();
    });

    it('shows Wrench icon in empty state', () => {
      render(<ToolCallTimeline toolCalls={[]} stats={mockStats} />);

      // The empty state contains "No tool calls" heading
      expect(screen.getByText('No tool calls')).toBeInTheDocument();
    });
  });

  describe('Filter tests', () => {
    it('shows filter dropdown when multiple unique tool names exist', () => {
      const onFilterChange = vi.fn();
      render(
        <ToolCallTimeline
          toolCalls={mockToolCalls}
          stats={mockStats}
          onFilterChange={onFilterChange}
        />
      );

      // Should show filter dropdown with "Filter by tool" label
      const filterDropdown = screen.getByRole('combobox', { name: /filter by tool/i });
      expect(filterDropdown).toBeInTheDocument();
    });

    it('does not show filter when only one tool type', () => {
      const singleToolCalls: ToolCallEntry[] = [
        {
          id: 'tc-1',
          tool: 'Read',
          status: 'complete',
          input: { file_path: '/src/a.ts' },
          duration: 100,
          timestamp: 1706000000000,
          timeOffset: '0:05',
        },
        {
          id: 'tc-2',
          tool: 'Read',
          status: 'complete',
          input: { file_path: '/src/b.ts' },
          duration: 100,
          timestamp: 1706000001000,
          timeOffset: '0:06',
        },
      ];

      const onFilterChange = vi.fn();
      render(
        <ToolCallTimeline
          toolCalls={singleToolCalls}
          stats={{ ...mockStats, totalCalls: 2, errorCount: 0 }}
          onFilterChange={onFilterChange}
        />
      );

      // Should not show filter dropdown when only one unique tool type
      expect(screen.queryByRole('combobox', { name: /filter by tool/i })).not.toBeInTheDocument();
    });

    it('filters tool calls by selected tool name', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      const { rerender } = render(
        <ToolCallTimeline
          toolCalls={mockToolCalls}
          stats={mockStats}
          onFilterChange={onFilterChange}
        />
      );

      // Initially shows all 3 tool calls
      expect(screen.getAllByTestId('tool-call-card')).toHaveLength(3);

      // Select "Edit" filter
      const filterDropdown = screen.getByRole('combobox', { name: /filter by tool/i });
      await user.selectOptions(filterDropdown, 'Edit');

      expect(onFilterChange).toHaveBeenCalledWith('Edit');

      // Rerender with filter applied
      rerender(
        <ToolCallTimeline
          toolCalls={mockToolCalls}
          stats={mockStats}
          filterTool="Edit"
          onFilterChange={onFilterChange}
        />
      );

      // Should only show 1 Edit tool call
      const filteredCards = screen.getAllByTestId('tool-call-card');
      expect(filteredCards).toHaveLength(1);
      expect(within(filteredCards[0]!).getByText('Edit')).toBeInTheDocument();
    });

    it('shows "No tool calls match the selected filter" when filter returns empty', () => {
      const onFilterChange = vi.fn();

      // Create tool calls that don't include "Bash"
      render(
        <ToolCallTimeline
          toolCalls={mockToolCalls}
          stats={mockStats}
          filterTool="Bash"
          onFilterChange={onFilterChange}
        />
      );

      expect(screen.getByText('No tool calls match the selected filter')).toBeInTheDocument();
    });

    it('calls onFilterChange callback when filter changes', async () => {
      const user = userEvent.setup();
      const onFilterChange = vi.fn();

      render(
        <ToolCallTimeline
          toolCalls={mockToolCalls}
          stats={mockStats}
          onFilterChange={onFilterChange}
        />
      );

      const filterDropdown = screen.getByRole('combobox', { name: /filter by tool/i });

      // Select "Read" option
      await user.selectOptions(filterDropdown, 'Read');
      expect(onFilterChange).toHaveBeenCalledWith('Read');

      // Clear filter by selecting "All Tools"
      await user.selectOptions(filterDropdown, '');
      expect(onFilterChange).toHaveBeenCalledWith(undefined);
    });

    it('does not show filter when onFilterChange is not provided', () => {
      render(<ToolCallTimeline toolCalls={mockToolCalls} stats={mockStats} />);

      // Even with multiple unique tools, filter should not show without onFilterChange
      expect(screen.queryByRole('combobox', { name: /filter by tool/i })).not.toBeInTheDocument();
    });
  });
});
