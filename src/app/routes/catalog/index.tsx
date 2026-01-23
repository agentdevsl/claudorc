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
import { Button } from '@/app/components/ui/button';
import type { Workflow } from '@/db/schema/workflows';

export const Route = createFileRoute('/catalog/')({
  component: CatalogPage,
});

/**
 * Workflow list item type for the catalog display
 */
type WorkflowListItem = {
  id: string;
  name: string;
  description: string | null;
  status: string | null;
  nodeCount: number;
  createdAt: string;
  updatedAt: string;
};

/**
 * Format a date string for display
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Status badge component for workflow status
 */
function StatusBadge({ status }: { status: string | null }): React.JSX.Element {
  const statusConfig = {
    draft: {
      label: 'Draft',
      className: 'bg-warning-muted text-warning border-warning/20',
    },
    published: {
      label: 'Published',
      className: 'bg-done-muted text-done border-done/20',
    },
    archived: {
      label: 'Archived',
      className: 'bg-fg-subtle/10 text-fg-muted border-border',
    },
  } as const;

  type StatusKey = keyof typeof statusConfig;
  const statusKey = (status ?? 'draft') as StatusKey;
  const config = statusConfig[statusKey] ?? statusConfig.draft;
  const { label, className } = config;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * Workflow card component for displaying workflow in the catalog
 */
function WorkflowCard({
  workflow,
  onSelect,
  onEdit,
  onDelete,
}: {
  workflow: WorkflowListItem;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}): React.JSX.Element {
  return (
    <div
      className="group relative flex flex-col rounded-xl border border-border bg-surface p-4 transition-all hover:border-accent/50 hover:shadow-md"
      data-testid={`workflow-card-${workflow.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 rounded"
        >
          <h3 className="font-semibold text-fg line-clamp-1 group-hover:text-accent transition-colors">
            {workflow.name}
          </h3>
        </button>
        <StatusBadge status={workflow.status} />
      </div>

      {/* Description */}
      <button type="button" onClick={onSelect} className="mt-2 flex-1 text-left focus:outline-none">
        <p className="text-sm text-fg-muted line-clamp-2 min-h-[2.5rem]">
          {workflow.description || 'No description'}
        </p>
      </button>

      {/* Metadata */}
      <div className="mt-4 flex items-center gap-4 text-xs text-fg-subtle">
        <span className="flex items-center gap-1">
          <FlowArrow className="h-3.5 w-3.5" />
          {workflow.nodeCount} nodes
        </span>
        <span>Updated {formatDate(workflow.updatedAt)}</span>
      </div>

      {/* Actions - visible on hover */}
      <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="h-7 w-7 p-0"
          title="Edit workflow"
        >
          <PencilSimple className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="h-7 w-7 p-0 text-danger hover:text-danger hover:bg-danger/10"
          title="Delete workflow"
        >
          <Trash className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Catalog page component
 * Displays a list of saved workflows with search, filtering, and actions
 */
function CatalogPage(): React.JSX.Element {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch workflows from API
  const fetchWorkflows = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/workflows');
      const result = await response.json();

      if (result.ok) {
        // Transform API response to list items
        const items: WorkflowListItem[] = result.data.items.map((w: Workflow) => ({
          id: w.id,
          name: w.name,
          description: w.description,
          status: w.status,
          nodeCount: w.nodes?.length ?? 0,
          createdAt: w.createdAt,
          updatedAt: w.updatedAt,
        }));
        setWorkflows(items);
      } else {
        setError(result.error?.message ?? 'Failed to load workflows');
      }
    } catch (err) {
      console.error('[Catalog] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load workflows on mount
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  // Filter workflows by search query
  const filteredWorkflows = useMemo(() => {
    if (!searchQuery.trim()) {
      return workflows;
    }

    const query = searchQuery.toLowerCase();
    return workflows.filter(
      (w) => w.name.toLowerCase().includes(query) || w.description?.toLowerCase().includes(query)
    );
  }, [workflows, searchQuery]);

  // Handle workflow selection (navigate to detail view)
  const handleSelectWorkflow = useCallback(
    (workflowId: string) => {
      navigate({ to: '/catalog/$workflowId', params: { workflowId } });
    },
    [navigate]
  );

  // Handle edit workflow (navigate to designer with workflow ID)
  const handleEditWorkflow = useCallback(
    (workflowId: string) => {
      navigate({ to: '/designer', search: { id: workflowId } });
    },
    [navigate]
  );

  // Handle delete workflow with confirmation
  const handleDeleteWorkflow = useCallback(async (workflowId: string, workflowName: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${workflowName}"? This action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(workflowId);

    try {
      const response = await fetch(`/api/workflows/${workflowId}`, {
        method: 'DELETE',
      });

      // DELETE returns 204 No Content on success
      if (response.status === 204 || response.ok) {
        // Remove from local state
        setWorkflows((prev) => prev.filter((w) => w.id !== workflowId));
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
  }, []);

  // Handle create new workflow
  const handleCreateWorkflow = useCallback(() => {
    navigate({ to: '/designer' });
  }, [navigate]);

  // Loading state
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
        <div className="flex items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search workflows..."
              className="w-48 rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              data-testid="workflow-search"
            />
          </div>

          <Button onClick={handleCreateWorkflow} data-testid="create-workflow-button">
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        </div>
      }
    >
      <div data-testid="catalog-page" className="p-6">
        {/* Error state */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger-muted/50 border border-danger/20 text-sm text-danger flex items-center justify-between">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={fetchWorkflows} className="ml-4 shrink-0">
              Retry
            </Button>
          </div>
        )}

        {/* Empty state - no workflows */}
        {workflows.length === 0 ? (
          <div className="flex items-center justify-center min-h-[60vh]">
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
        ) : filteredWorkflows.length === 0 ? (
          /* No search results */
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
            <MagnifyingGlass className="h-12 w-12 text-fg-subtle mb-4" />
            <p className="text-fg-muted">No workflows match "{searchQuery}"</p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-sm text-accent hover:text-accent/80"
            >
              Clear search
            </button>
          </div>
        ) : (
          /* Workflow grid */
          <div
            className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            data-testid="workflow-grid"
          >
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onSelect={() => handleSelectWorkflow(workflow.id)}
                onEdit={() => handleEditWorkflow(workflow.id)}
                onDelete={() => handleDeleteWorkflow(workflow.id, workflow.name)}
              />
            ))}
          </div>
        )}

        {/* Deleting overlay */}
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/50 backdrop-blur-sm">
            <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-3 shadow-lg border border-border">
              <Spinner className="h-4 w-4 animate-spin" />
              <span className="text-sm text-fg">Deleting workflow...</span>
            </div>
          </div>
        )}
      </div>
    </LayoutShell>
  );
}
