import { CaretLeft, Warning } from '@phosphor-icons/react';
import { type Edge, type Node, useEdgesState, useNodesState, type Viewport } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '@xyflow/react/dist/style.css';

import type { Workflow } from '@/db/schema/workflows';
import { AIGenerateDialog } from './AIGenerateDialog';
import { type SavedWorkflow, SavedWorkflowsPanel } from './SavedWorkflowsPanel';
import { WorkflowCanvas } from './WorkflowCanvas';
import { WorkflowToolbar } from './WorkflowToolbar';

/** Extended template with skills/commands/agents from sync */
interface TemplateWithContent {
  id: string;
  name: string;
  description?: string | null;
  status?: 'active' | 'syncing' | 'error' | 'disabled' | null;
  cachedSkills?: Array<{ id: string; name: string; description?: string }> | null;
  cachedCommands?: Array<{ name: string; description?: string }> | null;
  cachedAgents?: Array<{ name: string; description?: string }> | null;
}

/**
 * Props for the WorkflowDesigner component
 */
export interface WorkflowDesignerProps {
  /** Initial workflow data for editing existing workflows */
  initialWorkflow?: Workflow;
  /** Whether the designer is in read-only mode */
  readOnly?: boolean;
}

/**
 * Maps standard node types to compact node types for the v3 pill design.
 * Note: A similar function exists in src/lib/workflow-dsl/layout.ts for DSL operations.
 */
function mapToCompactNodeType(type: string): string {
  switch (type) {
    case 'start':
      return 'compactStart';
    case 'end':
      return 'compactEnd';
    case 'command':
      return 'compactCommand';
    case 'skill':
      return 'compactSkill';
    case 'agent':
      return 'compactAgent';
    default:
      // Warn about unmapped types - may indicate a bug or missing mapping
      console.warn(
        `[WorkflowDesigner] Unknown node type "${type}" not mapped to compact type. Node may not render correctly.`
      );
      return type;
  }
}

/**
 * Default nodes for a new workflow (start and end nodes)
 * Uses compact v3 node types for modern visual design
 */
const getDefaultNodes = (): Node[] => [
  {
    id: 'start-1',
    type: 'compactStart',
    position: { x: 400, y: 80 },
    data: { label: 'Start', nodeIndex: 0, nodeType: 'start' },
  },
  {
    id: 'end-1',
    type: 'compactEnd',
    position: { x: 400, y: 200 },
    data: { label: 'Done', nodeIndex: 1, nodeType: 'end' },
  },
];

/**
 * Convert DB workflow (DSL types) to ReactFlow nodes/edges.
 *
 * DSL types use:
 * - Nodes: typed fields based on node type (e.g., skillId, agentId) + `label` + `description`
 * - Edges: sourceNodeId/targetNodeId instead of source/target
 *
 * ReactFlow expects:
 * - Nodes: generic `data` object with compact v3 types
 * - Edges: source/target fields
 */
const workflowToNodesEdges = (workflow: Workflow): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] =
    workflow.nodes?.map((n, index) => {
      // Extract common fields for ReactFlow data object
      const { id, type, position, ...rest } = n;
      return {
        id,
        type: mapToCompactNodeType(type), // Convert to compact v3 node type
        position,
        data: {
          ...rest, // Put remaining fields (label, description, etc.) into data
          nodeIndex: index, // For staggered animation
          nodeType: type, // Original type for reference
        },
      };
    }) ?? getDefaultNodes();

  const edges: Edge[] =
    workflow.edges?.map((e) => {
      // Map DSL sourceNodeId/targetNodeId to ReactFlow source/target
      const { id, type, sourceNodeId, targetNodeId, ...rest } = e;
      return {
        id,
        source: sourceNodeId,
        target: targetNodeId,
        type: type ?? 'sequential',
        data: rest, // Put remaining fields (label, metadata, etc.) into data
      };
    }) ?? [];

  return { nodes, edges };
};

/**
 * WorkflowDesigner is the main container component for the visual workflow editor.
 * It orchestrates the canvas, toolbar, saved workflows panel, and AI generation dialog.
 *
 * Layout:
 * - Main area: Canvas with toolbar overlay
 * - Right sidebar: Saved workflows catalog with save status
 */
export function WorkflowDesigner({
  initialWorkflow,
  readOnly = false,
}: WorkflowDesignerProps): React.JSX.Element {
  // Initialize nodes and edges from initial workflow or defaults
  const initialState = initialWorkflow
    ? workflowToNodesEdges(initialWorkflow)
    : { nodes: getDefaultNodes(), edges: [] };

  // ReactFlow state management
  const [nodes, setNodes, onNodesChange] = useNodesState(initialState.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialState.edges);

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport | undefined>(
    initialWorkflow?.viewport
      ? {
          x: initialWorkflow.viewport.x,
          y: initialWorkflow.viewport.y,
          zoom: initialWorkflow.viewport.zoom,
        }
      : undefined
  );

  // Sidebar collapse state
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Saved workflows state
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(
    initialWorkflow?.id ?? null
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);

  // Track last saved state to detect changes
  const lastSavedStateRef = useRef<string>('');

  // Org templates from API (used by AIGenerateDialog)
  const [templates, setTemplates] = useState<TemplateWithContent[]>([]);

  // Fetch org templates on mount (for AI generation)
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/templates?scope=org');
        const result = await response.json();

        if (result.ok && result.data?.items) {
          setTemplates(result.data.items);
        }
      } catch (err) {
        console.error('[Designer] Template fetch error:', err);
      }
    }

    fetchTemplates();
  }, []);

  // Fetch saved workflows on mount
  useEffect(() => {
    async function fetchWorkflows() {
      try {
        const response = await fetch('/api/workflows');
        const result = await response.json();

        if (result.ok && result.data?.items) {
          setSavedWorkflows(
            result.data.items.map((w: Workflow) => ({
              id: w.id,
              name: w.name,
              description: w.description,
              updatedAt: new Date(w.updatedAt),
              nodeCount: w.nodes?.length ?? 0,
              edgeCount: w.edges?.length ?? 0,
            }))
          );
        }
      } catch (err) {
        console.error('[Designer] Workflows fetch error:', err);
      } finally {
        setWorkflowsLoading(false);
      }
    }

    fetchWorkflows();
  }, []);

  // Track unsaved changes by comparing current state to last saved state
  useEffect(() => {
    const currentState = JSON.stringify({ nodes, edges });
    if (lastSavedStateRef.current && currentState !== lastSavedStateRef.current) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, edges]);

  // Update last saved state when workflow is loaded or saved
  const markAsSaved = useCallback(() => {
    lastSavedStateRef.current = JSON.stringify({ nodes, edges });
    setHasUnsavedChanges(false);
  }, [nodes, edges]);

  // Handle viewport changes
  const handleViewportChange = useCallback((newViewport: Viewport) => {
    setViewport(newViewport);
  }, []);

  // AI Generation handler - opens the AI dialog
  const handleGenerateAI = useCallback(() => {
    if (readOnly) return;
    setAiDialogOpen(true);
  }, [readOnly]);

  // Callback when AI workflow is generated from the dialog
  const handleAIWorkflowGenerated = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setNodes(newNodes);
      setEdges(newEdges);
      setAiDialogOpen(false);
      // Mark as unsaved since we have new content
      setHasUnsavedChanges(true);
    },
    [setNodes, setEdges]
  );

  // Save handler
  const handleSave = useCallback(async () => {
    if (readOnly) return;

    setIsSaving(true);
    setError(null);
    try {
      // TODO: Call save API endpoint when available
      console.log('Saving workflow...', { nodes, edges, viewport });
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Mark as saved and update saved workflows list
      markAsSaved();

      // Update the workflow in the list if it exists
      if (activeWorkflowId) {
        setSavedWorkflows((prev) =>
          prev.map((w) =>
            w.id === activeWorkflowId
              ? {
                  ...w,
                  updatedAt: new Date(),
                  nodeCount: nodes.length,
                  edgeCount: edges.length,
                }
              : w
          )
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Failed to save workflow:', err);
      setError(`Failed to save workflow: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [readOnly, nodes, edges, viewport, markAsSaved, activeWorkflowId]);

  // Clear handler / Create new workflow
  const handleCreateNew = useCallback(() => {
    if (readOnly) return;

    setNodes(getDefaultNodes());
    setEdges([]);
    setActiveWorkflowId(null);
    setHasUnsavedChanges(false);
    lastSavedStateRef.current = '';
  }, [readOnly, setNodes, setEdges]);

  // Select a saved workflow to load
  const handleSelectWorkflow = useCallback(
    async (workflow: SavedWorkflow) => {
      if (readOnly) return;

      // TODO: Fetch full workflow data from API
      // For now, simulate loading
      try {
        const response = await fetch(`/api/workflows/${workflow.id}`);
        const result = await response.json();

        if (result.ok && result.data) {
          const loaded = workflowToNodesEdges(result.data);
          setNodes(loaded.nodes);
          setEdges(loaded.edges);
          setActiveWorkflowId(workflow.id);

          // Mark initial state as saved
          setTimeout(() => {
            lastSavedStateRef.current = JSON.stringify({
              nodes: loaded.nodes,
              edges: loaded.edges,
            });
            setHasUnsavedChanges(false);
          }, 0);
        }
      } catch (err) {
        console.error('[Designer] Failed to load workflow:', err);
        setError('Failed to load workflow');
      }
    },
    [readOnly, setNodes, setEdges]
  );

  // Delete a saved workflow
  const handleDeleteWorkflow = useCallback(
    async (workflowId: string) => {
      try {
        // TODO: Call delete API endpoint
        console.log('Deleting workflow:', workflowId);

        // Remove from list
        setSavedWorkflows((prev) => prev.filter((w) => w.id !== workflowId));

        // If deleting active workflow, clear the canvas
        if (workflowId === activeWorkflowId) {
          handleCreateNew();
        }
      } catch (err) {
        console.error('[Designer] Failed to delete workflow:', err);
        setError('Failed to delete workflow');
      }
    },
    [activeWorkflowId, handleCreateNew]
  );

  return (
    <div className="flex h-full w-full" data-testid="workflow-designer">
      {/* Main area - Canvas with Toolbar */}
      <div className="relative flex-1 min-w-0">
        {/* Error banner */}
        {error && (
          <div
            className="absolute left-[var(--space-4)] right-[var(--space-4)] top-16 z-20 flex items-center justify-between rounded-[var(--radius)] border border-[var(--danger-muted)] bg-[var(--danger-subtle)] px-[var(--space-4)] py-[var(--space-3)] text-[var(--text-sm)] text-[var(--danger-fg)]"
            role="alert"
            data-testid="workflow-error-banner"
          >
            <div className="flex items-center gap-2">
              <Warning className="h-4 w-4" weight="fill" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              className="text-[var(--danger-fg)] hover:opacity-70 transition-opacity"
              onClick={() => setError(null)}
              aria-label="Dismiss error"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        {/* Toolbar overlay */}
        <WorkflowToolbar
          onGenerateAI={handleGenerateAI}
          onSave={handleSave}
          onClear={handleCreateNew}
          isGenerating={false}
          isSaving={isSaving}
          canUndo={false}
          canRedo={false}
        />

        {/* Canvas */}
        <WorkflowCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          viewport={viewport}
          onViewportChange={handleViewportChange}
          readOnly={readOnly}
        />
      </div>

      {/* Collapse toggle for right panel */}
      {rightPanelCollapsed && (
        <button
          type="button"
          onClick={() => setRightPanelCollapsed(false)}
          className="hidden xl:flex items-center justify-center w-6 bg-[var(--bg-default)] border-l border-[var(--border-default)] hover:bg-[var(--bg-subtle)] transition-colors"
          aria-label="Expand workflows panel"
        >
          <CaretLeft className="h-4 w-4 text-[var(--fg-muted)]" />
        </button>
      )}

      {/* Right sidebar - Saved Workflows */}
      <SavedWorkflowsPanel
        workflows={savedWorkflows}
        activeWorkflowId={activeWorkflowId}
        hasUnsavedChanges={hasUnsavedChanges}
        isLoading={workflowsLoading}
        collapsed={rightPanelCollapsed}
        onCollapse={setRightPanelCollapsed}
        onSelect={handleSelectWorkflow}
        onCreateNew={handleCreateNew}
        onDelete={handleDeleteWorkflow}
        onSave={handleSave}
      />

      {/* AI Generate Dialog */}
      <AIGenerateDialog
        open={aiDialogOpen}
        onOpenChange={setAiDialogOpen}
        templates={templates}
        onGenerate={handleAIWorkflowGenerated}
      />
    </div>
  );
}
