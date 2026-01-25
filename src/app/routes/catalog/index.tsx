import {
  FlowArrow,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  Spinner,
  Trash,
} from '@phosphor-icons/react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/app/components/features/empty-state';
import { LayoutShell } from '@/app/components/features/layout-shell';
import { WorkflowPreviewSvg } from '@/app/components/features/workflow-preview';
import { Button } from '@/app/components/ui/button';
import type { Workflow } from '@/db/schema/workflows';
import { cn } from '@/lib/utils/cn';
import type { WorkflowEdge, WorkflowNode } from '@/lib/workflow-dsl/types';

export const Route = createFileRoute('/catalog/')({
  component: CatalogPage,
});

// =============================================================================
// Types
// =============================================================================

type WorkflowListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
};

// =============================================================================
// Helper Functions
// =============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return `Today at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (diffDays === 1) {
    return 'Yesterday';
  }
  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function calculateStats(nodes: WorkflowNode[]) {
  const stats = {
    nodeCount: nodes.length,
    skillCount: 0,
    agentCount: 0,
    contextCount: 0,
    startCount: 0,
    endCount: 0,
    logicCount: 0,
  };

  for (const node of nodes) {
    switch (node.type) {
      case 'skill':
        stats.skillCount++;
        break;
      case 'agent':
        stats.agentCount++;
        break;
      case 'context':
        stats.contextCount++;
        break;
      case 'start':
        stats.startCount++;
        break;
      case 'end':
        stats.endCount++;
        break;
      case 'conditional':
      case 'loop':
      case 'parallel':
        stats.logicCount++;
        break;
    }
  }

  return stats;
}

// =============================================================================
// Status Badge - Matches wireframe .item-badge
// =============================================================================

function StatusBadge({ status }: { status: string | null }): React.JSX.Element {
  const isDraft = status === 'draft' || status === null;
  const isPublished = status === 'published';

  return (
    <span
      className={cn(
        'inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase rounded-full',
        isDraft && 'bg-surface-emphasis text-fg-muted',
        isPublished && 'bg-success-muted text-success'
      )}
    >
      {status ?? 'draft'}
    </span>
  );
}

// =============================================================================
// List Item - Matches wireframe .list-item
// =============================================================================

interface WorkflowListItemProps {
  workflow: WorkflowListItem;
  isSelected: boolean;
  onSelect: () => void;
}

function WorkflowListItemComponent({
  workflow,
  isSelected,
  onSelect,
}: WorkflowListItemProps): React.JSX.Element {
  const nodeCount = workflow.nodes?.length ?? 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full flex gap-3 p-3 border-b border-border-muted cursor-pointer text-left',
        'transition-colors duration-150',
        'hover:bg-surface-subtle',
        isSelected && 'bg-accent-muted border-l-2 border-l-accent'
      )}
      data-testid={`workflow-list-item-${workflow.id}`}
    >
      {/* Mini preview - 64x48 per wireframe */}
      <div className="w-16 h-12 bg-canvas border border-border-muted rounded shrink-0 overflow-hidden">
        <WorkflowPreviewSvg
          nodes={workflow.nodes ?? []}
          edges={workflow.edges ?? []}
          width={64}
          height={48}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div
          className={cn(
            'text-[13px] font-medium truncate mb-0.5',
            isSelected ? 'text-accent' : 'text-fg'
          )}
        >
          {workflow.name}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
          <StatusBadge status={workflow.status} />
          <span>{nodeCount} nodes</span>
        </div>
      </div>
    </button>
  );
}

// =============================================================================
// Stat Card - Matches wireframe .stat-card (simple value/label)
// =============================================================================

function StatCard({ value, label }: { value: number; label: string }): React.JSX.Element {
  return (
    <div className="bg-surface-subtle border border-border-muted rounded-md p-3 text-center">
      <div className="text-xl font-semibold text-fg mb-0.5">{value}</div>
      <div className="text-[11px] text-fg-subtle uppercase tracking-wide">{label}</div>
    </div>
  );
}

// =============================================================================
// Breakdown Item - Matches wireframe .breakdown-item (pill with dot)
// =============================================================================

interface BreakdownItemProps {
  type: string;
  count: number;
  color: string;
}

function BreakdownItem({ type, count, color }: BreakdownItemProps): React.JSX.Element {
  return (
    <div className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-subtle border border-border-muted rounded-md text-xs">
      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-semibold text-fg">{count}</span>
      <span className="text-fg-muted">{type}</span>
    </div>
  );
}

// =============================================================================
// Detail Panel - Matches wireframe .detail-panel
// =============================================================================

interface DetailPanelProps {
  workflow: WorkflowListItem | null;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}

function DetailPanel({
  workflow,
  onEdit,
  onDelete,
  isDeleting,
}: DetailPanelProps): React.JSX.Element {
  if (!workflow) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface">
        <div className="text-center text-fg-muted">
          <FlowArrow className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Select a workflow to view details</p>
        </div>
      </div>
    );
  }

  const stats = calculateStats(workflow.nodes ?? []);
  const nodes = workflow.nodes ?? [];
  const edges = workflow.edges ?? [];

  // Node type colors per design system
  const typeColors = {
    start: '#3fb950', // success-fg
    end: '#f85149', // danger-fg
    skill: '#f778ba', // secondary-fg
    context: '#d29922', // attention-fg
    agent: '#58a6ff', // accent-fg
    logic: '#a371f7', // done-fg
  } as const;

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-surface">
      {/* Large preview - 300px height, bg-canvas per wireframe */}
      <div className="h-[300px] bg-canvas border-b border-border flex items-center justify-center p-6">
        <WorkflowPreviewSvg
          nodes={nodes}
          edges={edges}
          width={600}
          height={250}
          showLabels={true}
        />
      </div>

      {/* Detail content - matches wireframe .detail-content */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Header with title and actions */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-fg mb-2">{workflow.name}</h2>
            <div className="flex gap-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold uppercase rounded-full',
                  workflow.status === 'published'
                    ? 'bg-success-muted text-success'
                    : 'bg-surface-emphasis text-fg-muted'
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                {workflow.status ?? 'Draft'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <PencilSimple className="h-4 w-4 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
              className="text-danger border-danger/30 hover:bg-danger-muted"
            >
              {isDeleting ? (
                <Spinner className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <Trash className="h-4 w-4 mr-1.5" />
              )}
              Delete
            </Button>
          </div>
        </div>

        {/* Description */}
        {workflow.description ? (
          <p className="text-sm text-fg-muted leading-relaxed mb-6">{workflow.description}</p>
        ) : (
          <p className="text-sm text-fg-subtle italic mb-6">No description available</p>
        )}

        {/* Stats grid - 4 columns per wireframe */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <StatCard value={stats.nodeCount} label="Nodes" />
          <StatCard value={edges.length} label="Edges" />
          <StatCard value={stats.skillCount} label="Skills" />
          <StatCard value={stats.agentCount} label="Agents" />
        </div>

        {/* Node breakdown - pills per wireframe */}
        {stats.nodeCount > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-fg-subtle uppercase tracking-wide mb-3">
              Node Breakdown
            </h3>
            <div className="flex flex-wrap gap-2">
              {stats.startCount > 0 && (
                <BreakdownItem type="start" count={stats.startCount} color={typeColors.start} />
              )}
              {stats.skillCount > 0 && (
                <BreakdownItem type="skill" count={stats.skillCount} color={typeColors.skill} />
              )}
              {stats.agentCount > 0 && (
                <BreakdownItem type="agent" count={stats.agentCount} color={typeColors.agent} />
              )}
              {stats.contextCount > 0 && (
                <BreakdownItem
                  type="context"
                  count={stats.contextCount}
                  color={typeColors.context}
                />
              )}
              {stats.logicCount > 0 && (
                <BreakdownItem type="logic" count={stats.logicCount} color={typeColors.logic} />
              )}
              {stats.endCount > 0 && (
                <BreakdownItem type="end" count={stats.endCount} color={typeColors.end} />
              )}
            </div>
          </div>
        )}

        {/* Timestamps - matches wireframe .timestamps */}
        <div className="flex gap-6 text-xs text-fg-subtle">
          <div>
            <span className="text-fg-muted mr-1">Created:</span>
            {formatDate(workflow.createdAt)}
          </div>
          <div>
            <span className="text-fg-muted mr-1">Updated:</span>
            {formatDate(workflow.updatedAt)}
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Catalog Page
// =============================================================================

function CatalogPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workflows');
      const result = await response.json();

      if (result.ok) {
        const items: WorkflowListItem[] = result.data.items.map((w: Workflow) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          status: w.status,
          nodes: w.nodes ?? [],
          edges: w.edges ?? [],
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        }));
        setWorkflows(items);

        if (items.length > 0 && !selectedId) {
          setSelectedId(items[0]?.id ?? null);
        }
      } else {
        setError(result.error?.message ?? 'Failed to load workflows');
      }
    } catch (err) {
      console.error('[Catalog] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) return workflows;

    const query = searchQuery.toLowerCase();
    return workflows.filter(
      (w) => w.name.toLowerCase().includes(query) || w.description?.toLowerCase().includes(query)
    );
  }, [workflows, searchQuery]);

  const selectedWorkflow = useMemo(
    () => workflows.find((w) => w.id === selectedId) ?? null,
    [workflows, selectedId]
  );

  const handleEditWorkflow = useCallback(
    (workflowId: string) => {
      navigate({ to: '/designer', search: { id: workflowId } });
    },
    [navigate]
  );

  const handleDeleteWorkflow = useCallback(
    async (workflowId: string, workflowName: string) => {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${workflowName}"? This action cannot be undone.`
      );

      if (!confirmed) return;

      setDeletingId(workflowId);

      try {
        const response = await fetch(`/api/workflows/${workflowId}`, { method: 'DELETE' });

        if (response.status === 204 || response.ok) {
          setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));

          if (selectedId === workflowId) {
            const remaining = workflows.filter((w) => w.id !== workflowId);
            setSelectedId(remaining[0]?.id ?? null);
          }
        } else {
          const result = await response.json();
          setError(result.error?.message ?? 'Failed to delete workflow');
        }
      } catch (err) {
        console.error('[Catalog] Delete error:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete workflow');
      } finally {
        setDeletingId(null);
      }
    },
    [selectedId, workflows]
  );

  const handleCreateWorkflow = useCallback(() => {
    navigate({ to: '/designer' });
  }, [navigate]);

  if (isLoading) {
    return (
      <LayoutShell breadcrumbs={[{ label: 'Workflow Catalog' }]}>
        <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-state">
          <div className="flex items-center gap-2 text-fg-muted">
            <Spinner className="h-5 w-5 animate-spin" />
            Loading workflows...
          </div>
        </div>
      </LayoutShell>
    );
  }

  return (
    <LayoutShell
      breadcrumbs={[{ label: 'Workflow Catalog' }]}
      actions={
        <Button onClick={handleCreateWorkflow} data-testid="create-workflow-button">
          <Plus className="h-4 w-4 mr-1.5" />
          New Workflow
        </Button>
      }
    >
      <div data-testid="catalog-page" className="flex flex-col h-[calc(100vh-8rem)]">
        {error && (
          <div className="m-4 p-4 rounded-md bg-danger-muted border border-danger/20 text-sm text-danger flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={fetchWorkflows}>
              Retry
            </Button>
          </div>
        )}

        {workflows.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={FlowArrow}
              title="No Workflows Yet"
              subtitle="Create your first workflow to orchestrate agent tasks with visual flow control."
              primaryAction={{
                label: 'Create Workflow',
                onClick: handleCreateWorkflow,
              }}
            />
          </div>
        ) : (
          /* Split view - 320px list panel per wireframe */
          <div className="flex-1 flex overflow-hidden">
            {/* Left panel - .list-panel */}
            <div className="w-80 shrink-0 border-r border-border flex flex-col">
              {/* List header */}
              <div className="p-3 border-b border-border bg-surface">
                <div className="relative mb-3">
                  <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full rounded-md border border-border bg-surface-subtle py-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none"
                    data-testid="workflow-search"
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-fg-muted">
                  <span className="font-semibold">{filteredWorkflows.length} workflows</span>
                  <span>Sort: Recent</span>
                </div>
              </div>

              {/* Workflow list */}
              <div className="flex-1 overflow-y-auto">
                {filteredWorkflows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center p-4">
                    <MagnifyingGlass className="h-8 w-8 text-fg-subtle mb-2" />
                    <p className="text-sm text-fg-muted">No workflows match "{searchQuery}"</p>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="mt-1 text-xs text-accent hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  filteredWorkflows.map((workflow) => (
                    <WorkflowListItemComponent
                      key={workflow.id}
                      workflow={workflow}
                      isSelected={selectedId === workflow.id}
                      onSelect={() => setSelectedId(workflow.id)}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Right panel - .detail-panel */}
            <DetailPanel
              workflow={selectedWorkflow}
              onEdit={() => selectedWorkflow && handleEditWorkflow(selectedWorkflow.id)}
              onDelete={() =>
                selectedWorkflow && handleDeleteWorkflow(selectedWorkflow.id, selectedWorkflow.name)
              }
              isDeleting={deletingId === selectedWorkflow?.id}
            />
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
