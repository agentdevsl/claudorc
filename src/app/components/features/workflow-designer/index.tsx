import {
  CaretDown,
  CaretLeft,
  CaretRight,
  CloudArrowDown,
  Command,
  Cube,
  FileCode,
  Lightning,
  Plus,
  Robot,
  Sparkle,
  Terminal,
  Warning,
} from '@phosphor-icons/react';
import { type Edge, type Node, useEdgesState, useNodesState, type Viewport } from '@xyflow/react';
import { useCallback, useEffect, useState } from 'react';
import '@xyflow/react/dist/style.css';

import { Button } from '@/app/components/ui/button';
import type { Workflow } from '@/db/schema/workflows';
import { cn } from '@/lib/utils/cn';
import { AIGenerateDialog } from './AIGenerateDialog';
import {
  inspectorFieldVariants,
  inspectorLabelVariants,
  inspectorValueVariants,
  panelHeaderVariants,
  sidebarPanelVariants,
  templateCardVariants,
} from './styles';
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
 * Default nodes for a new workflow (start and end nodes)
 */
const getDefaultNodes = (): Node[] => [
  {
    id: 'start-1',
    type: 'start',
    position: { x: 400, y: 80 },
    data: { label: 'Start' },
  },
  {
    id: 'end-1',
    type: 'end',
    position: { x: 400, y: 500 },
    data: { label: 'End' },
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
 * - Nodes: generic `data` object
 * - Edges: source/target fields
 */
const workflowToNodesEdges = (workflow: Workflow): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] =
    workflow.nodes?.map((n) => {
      // Extract common fields for ReactFlow data object
      const { id, type, position, ...rest } = n;
      return {
        id,
        type,
        position,
        data: rest, // Put remaining fields (label, description, etc.) into data
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
 * It orchestrates the canvas, toolbar, template picker, node inspector, and save dialog.
 *
 * Layout:
 * - Left sidebar: Template picker with real org templates
 * - Main area: Canvas with toolbar overlay
 * - Right sidebar: Node inspector with properties
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
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
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
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

  // Org templates from API
  const [templates, setTemplates] = useState<TemplateWithContent[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  // Fetch org templates on mount
  useEffect(() => {
    async function fetchTemplates() {
      try {
        const response = await fetch('/api/templates?scope=org');
        const result = await response.json();

        if (result.ok && result.data?.items) {
          setTemplates(result.data.items);
        } else {
          setTemplatesError(result.error?.message ?? 'Failed to load templates');
        }
      } catch (err) {
        console.error('[Designer] Template fetch error:', err);
        setTemplatesError(err instanceof Error ? err.message : 'Failed to load templates');
      } finally {
        setTemplatesLoading(false);
      }
    }

    fetchTemplates();
  }, []);

  // Handle node selection
  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (!readOnly) {
        setSelectedNode(node);
      }
    },
    [readOnly]
  );

  // Handle edge selection
  const handleEdgeClick = useCallback((_event: React.MouseEvent, _edge: Edge) => {
    // Clear node selection when clicking an edge
    setSelectedNode(null);
  }, []);

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
      setSelectedNode(null);
      setAiDialogOpen(false);
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
      // const workflowData = {
      //   nodes: nodes.map((n) => ({
      //     id: n.id,
      //     type: n.type ?? 'agent',
      //     position: n.position,
      //     data: n.data,
      //   })),
      //   edges: edges.map((e) => ({
      //     id: e.id,
      //     source: e.source,
      //     target: e.target,
      //     sourceHandle: e.sourceHandle,
      //     targetHandle: e.targetHandle,
      //     type: e.type,
      //     data: e.data,
      //   })),
      //   viewport,
      // };
      // await apiClient.workflows.save(initialWorkflow?.id, workflowData);
      console.log('Saving workflow...', { nodes, edges, viewport });
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      console.error('Failed to save workflow:', err);
      setError(`Failed to save workflow: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [readOnly, nodes, edges, viewport]);

  // Clear handler
  const handleClear = useCallback(() => {
    if (readOnly) return;

    setNodes(getDefaultNodes());
    setEdges([]);
    setSelectedNode(null);
    setSelectedTemplate(null);
  }, [readOnly, setNodes, setEdges]);

  // Add primitive (skill/command/agent) to canvas
  const handleAddPrimitive = useCallback(
    (
      type: 'skill' | 'command' | 'agent',
      name: string,
      description?: string,
      templateName?: string
    ) => {
      if (readOnly) return;

      // Calculate position - place between start and end, offset by existing nodes
      const existingCount = nodes.filter((n) => !['start', 'end'].includes(n.type ?? '')).length;
      const yOffset = 150 + existingCount * 120;

      const newNode: Node = {
        id: `${type}-${Date.now()}`,
        type,
        position: { x: 400, y: yOffset },
        data: {
          label: name,
          description: description ?? `${type} from ${templateName ?? 'template'}`,
          // Store the slash command format for skills
          ...(type === 'skill' && { skillId: name }),
          ...(type === 'command' && { commandName: name }),
          ...(type === 'agent' && { agentName: name }),
        },
      };

      setNodes((nds) => [...nds, newNode]);

      // Select the newly added node
      setSelectedNode(newNode);
    },
    [readOnly, nodes, setNodes]
  );

  // Get content counts for selected template
  const selectedTemplateData = templates.find((t) => t.id === selectedTemplate);
  const skillCount = selectedTemplateData?.cachedSkills?.length ?? 0;
  const commandCount = selectedTemplateData?.cachedCommands?.length ?? 0;
  const agentCount = selectedTemplateData?.cachedAgents?.length ?? 0;

  return (
    <div className="flex h-full w-full" data-testid="workflow-designer">
      {/* Left sidebar - Template Picker with real org templates */}
      <aside
        className={cn(
          sidebarPanelVariants({ side: 'left', collapsed: leftPanelCollapsed }),
          'hidden lg:flex',
          leftPanelCollapsed ? 'w-0' : 'w-72'
        )}
        data-testid="workflow-template-picker"
      >
        {/* Panel header */}
        <div className={cn(panelHeaderVariants())}>
          <div className="flex items-center gap-[var(--space-2)]">
            <Cube className="h-4 w-4 text-[var(--fg-muted)]" weight="duotone" />
            <h3 className="text-[var(--text-sm)] font-[var(--font-semibold)] text-[var(--fg-default)]">
              Org Templates
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLeftPanelCollapsed(true)}
            className="h-7 w-7"
            aria-label="Collapse panel"
          >
            <CaretLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Template list */}
        <div className="flex-1 overflow-y-auto p-[var(--space-3)]">
          {templatesLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-[var(--fg-muted)]">
                <CloudArrowDown className="h-4 w-4 animate-pulse" />
                <span className="text-[var(--text-xs)]">Loading templates...</span>
              </div>
            </div>
          ) : templatesError ? (
            <div className="rounded-[var(--radius)] border border-[var(--danger-muted)] bg-[var(--danger-subtle)] p-[var(--space-3)]">
              <div className="flex items-center gap-2 text-[var(--danger-fg)]">
                <Warning className="h-4 w-4" />
                <span className="text-[var(--text-xs)]">{templatesError}</span>
              </div>
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8">
              <FileCode className="h-8 w-8 mx-auto mb-2 text-[var(--fg-subtle)]" />
              <p className="text-[var(--text-sm)] text-[var(--fg-muted)]">No org templates</p>
              <p className="text-[var(--text-xs)] text-[var(--fg-subtle)] mt-1">
                Add templates in Org Templates
              </p>
            </div>
          ) : (
            <div className="space-y-[var(--space-2)]">
              {templates.map((template) => {
                const tSkills = template.cachedSkills ?? [];
                const tCommands = template.cachedCommands ?? [];
                const tAgents = template.cachedAgents ?? [];
                const isSelected = selectedTemplate === template.id;
                const hasContent = tSkills.length > 0 || tCommands.length > 0 || tAgents.length > 0;

                return (
                  <div key={template.id} className="space-y-[var(--space-1)]">
                    {/* Template header - collapsible */}
                    <button
                      type="button"
                      className={cn(templateCardVariants({ selected: isSelected }))}
                      onClick={() => setSelectedTemplate(isSelected ? null : template.id)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-[var(--space-2)]">
                          <CaretDown
                            className={cn(
                              'h-3 w-3 text-[var(--fg-muted)] transition-transform',
                              !isSelected && '-rotate-90'
                            )}
                          />
                          <span className="text-[var(--text-sm)] font-[var(--font-medium)] text-[var(--fg-default)]">
                            {template.name}
                          </span>
                        </div>
                        {template.status === 'syncing' && (
                          <CloudArrowDown className="h-3 w-3 text-[var(--accent-fg)] animate-pulse" />
                        )}
                      </div>
                      <div className="flex items-center gap-[var(--space-2)] text-[10px] text-[var(--fg-subtle)] ml-5">
                        {tSkills.length > 0 && <span>{tSkills.length} skills</span>}
                        {tCommands.length > 0 && <span>{tCommands.length} commands</span>}
                        {tAgents.length > 0 && <span>{tAgents.length} agents</span>}
                        {!hasContent && (
                          <span className="text-[var(--attention-fg)]">Not synced</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded content - Skills, Commands, Agents */}
                    {isSelected && hasContent && (
                      <div className="ml-2 pl-3 border-l-2 border-[var(--border-default)] space-y-[var(--space-3)]">
                        {/* Skills section */}
                        {tSkills.length > 0 && (
                          <div className="space-y-[var(--space-1)]">
                            <div className="flex items-center gap-[var(--space-1)] text-[10px] font-[var(--font-medium)] text-[var(--secondary-fg)] uppercase tracking-wide">
                              <Lightning className="h-3 w-3" weight="fill" />
                              <span>Skills</span>
                            </div>
                            <div className="space-y-[var(--space-1)]">
                              {tSkills.map((skill) => (
                                <button
                                  key={skill.id}
                                  type="button"
                                  onClick={() =>
                                    handleAddPrimitive(
                                      'skill',
                                      skill.name,
                                      skill.description,
                                      template.name
                                    )
                                  }
                                  className="group w-full flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-sm)] text-left hover:bg-[var(--secondary-subtle)] transition-colors"
                                >
                                  <Terminal className="h-3.5 w-3.5 text-[var(--secondary-fg)] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[var(--text-xs)] font-[var(--font-medium)] text-[var(--fg-default)] truncate">
                                      /{skill.name}
                                    </div>
                                    {skill.description && (
                                      <div className="text-[10px] text-[var(--fg-muted)] line-clamp-1">
                                        {skill.description}
                                      </div>
                                    )}
                                  </div>
                                  <Plus className="h-3.5 w-3.5 text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Commands section */}
                        {tCommands.length > 0 && (
                          <div className="space-y-[var(--space-1)]">
                            <div className="flex items-center gap-[var(--space-1)] text-[10px] font-[var(--font-medium)] text-[var(--attention-fg)] uppercase tracking-wide">
                              <Command className="h-3 w-3" weight="fill" />
                              <span>Commands</span>
                            </div>
                            <div className="space-y-[var(--space-1)]">
                              {tCommands.map((cmd) => (
                                <button
                                  key={cmd.name}
                                  type="button"
                                  onClick={() =>
                                    handleAddPrimitive(
                                      'command',
                                      cmd.name,
                                      cmd.description,
                                      template.name
                                    )
                                  }
                                  className="group w-full flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-sm)] text-left hover:bg-[var(--attention-subtle)] transition-colors"
                                >
                                  <Terminal className="h-3.5 w-3.5 text-[var(--attention-fg)] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[var(--text-xs)] font-[var(--font-medium)] text-[var(--fg-default)] truncate">
                                      /{cmd.name}
                                    </div>
                                    {cmd.description && (
                                      <div className="text-[10px] text-[var(--fg-muted)] line-clamp-1">
                                        {cmd.description}
                                      </div>
                                    )}
                                  </div>
                                  <Plus className="h-3.5 w-3.5 text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Agents section */}
                        {tAgents.length > 0 && (
                          <div className="space-y-[var(--space-1)]">
                            <div className="flex items-center gap-[var(--space-1)] text-[10px] font-[var(--font-medium)] text-[var(--accent-fg)] uppercase tracking-wide">
                              <Robot className="h-3 w-3" weight="fill" />
                              <span>Agents</span>
                            </div>
                            <div className="space-y-[var(--space-1)]">
                              {tAgents.map((agent) => (
                                <button
                                  key={agent.name}
                                  type="button"
                                  onClick={() =>
                                    handleAddPrimitive(
                                      'agent',
                                      agent.name,
                                      agent.description,
                                      template.name
                                    )
                                  }
                                  className="group w-full flex items-center gap-[var(--space-2)] p-[var(--space-2)] rounded-[var(--radius-sm)] text-left hover:bg-[var(--accent-subtle)] transition-colors"
                                >
                                  <Robot className="h-3.5 w-3.5 text-[var(--accent-fg)] flex-shrink-0" />
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[var(--text-xs)] font-[var(--font-medium)] text-[var(--fg-default)] truncate">
                                      {agent.name}
                                    </div>
                                    {agent.description && (
                                      <div className="text-[10px] text-[var(--fg-muted)] line-clamp-1">
                                        {agent.description}
                                      </div>
                                    )}
                                  </div>
                                  <Plus className="h-3.5 w-3.5 text-[var(--fg-subtle)] opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected template summary */}
        {selectedTemplateData && (
          <div className="border-t border-[var(--border-default)] p-[var(--space-3)] bg-[var(--bg-subtle)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--text-xs)] font-[var(--font-medium)] text-[var(--fg-muted)]">
                Selected: {selectedTemplateData.name}
              </span>
            </div>
            <div className="flex gap-3 text-[var(--text-xs)]">
              <span className="text-[var(--secondary-fg)]">{skillCount} Skills</span>
              <span className="text-[var(--attention-fg)]">{commandCount} Commands</span>
              <span className="text-[var(--accent-fg)]">{agentCount} Agents</span>
            </div>
          </div>
        )}
      </aside>

      {/* Collapse toggle for left panel */}
      {leftPanelCollapsed && (
        <button
          type="button"
          onClick={() => setLeftPanelCollapsed(false)}
          className="hidden lg:flex items-center justify-center w-6 bg-[var(--bg-default)] border-r border-[var(--border-default)] hover:bg-[var(--bg-subtle)] transition-colors"
          aria-label="Expand template panel"
        >
          <CaretRight className="h-4 w-4 text-[var(--fg-muted)]" />
        </button>
      )}

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
          onClear={handleClear}
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
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
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
          aria-label="Expand inspector panel"
        >
          <CaretLeft className="h-4 w-4 text-[var(--fg-muted)]" />
        </button>
      )}

      {/* Right sidebar - Node Inspector */}
      <aside
        className={cn(
          sidebarPanelVariants({ side: 'right', collapsed: rightPanelCollapsed }),
          'hidden xl:flex',
          rightPanelCollapsed ? 'w-0' : 'w-80'
        )}
        data-testid="workflow-node-inspector"
      >
        {/* Panel header */}
        <div className={cn(panelHeaderVariants())}>
          <div className="flex items-center gap-[var(--space-2)]">
            <Sparkle className="h-4 w-4 text-[var(--fg-muted)]" weight="duotone" />
            <h3 className="text-[var(--text-sm)] font-[var(--font-semibold)] text-[var(--fg-default)]">
              Node Inspector
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setRightPanelCollapsed(true)}
            className="h-7 w-7"
            aria-label="Collapse panel"
          >
            <CaretRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Inspector content */}
        <div className="flex-1 overflow-y-auto p-[var(--space-4)]">
          {selectedNode ? (
            <div className="space-y-[var(--space-1)]">
              {/* Node type badge */}
              <div className={cn(inspectorFieldVariants())}>
                <span className={cn(inspectorLabelVariants())}>Type</span>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'px-[var(--space-2)] py-[2px] rounded-[var(--radius-sm)]',
                      'text-[10px] font-[var(--font-medium)] uppercase',
                      selectedNode.type === 'start' &&
                        'bg-[var(--success-subtle)] text-[var(--success-fg)]',
                      selectedNode.type === 'end' &&
                        'bg-[var(--danger-subtle)] text-[var(--danger-fg)]',
                      selectedNode.type === 'agent' &&
                        'bg-[var(--accent-subtle)] text-[var(--accent-fg)]',
                      selectedNode.type === 'skill' &&
                        'bg-[var(--secondary-subtle)] text-[var(--secondary-fg)]',
                      selectedNode.type === 'command' &&
                        'bg-[var(--attention-subtle)] text-[var(--attention-fg)]',
                      !['start', 'end', 'agent', 'skill', 'command'].includes(
                        selectedNode.type ?? ''
                      ) && 'bg-[var(--bg-muted)] text-[var(--fg-muted)]'
                    )}
                  >
                    {selectedNode.type ?? 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Label */}
              <div className={cn(inspectorFieldVariants())}>
                <span className={cn(inspectorLabelVariants())}>Label</span>
                <p className={cn(inspectorValueVariants())}>
                  {(selectedNode.data as { label?: string })?.label ?? 'Untitled'}
                </p>
              </div>

              {/* Description / AI Summary */}
              {(selectedNode.data as { description?: string })?.description && (
                <div className={cn(inspectorFieldVariants())}>
                  <span className={cn(inspectorLabelVariants())}>AI Summary</span>
                  <p className="text-[var(--text-xs)] text-[var(--fg-muted)] leading-relaxed">
                    {(selectedNode.data as { description?: string }).description}
                  </p>
                </div>
              )}

              {/* Position */}
              <div className={cn(inspectorFieldVariants())}>
                <span className={cn(inspectorLabelVariants())}>Position</span>
                <p className={cn(inspectorValueVariants(), 'font-mono text-[var(--text-xs)]')}>
                  x: {Math.round(selectedNode.position.x)}, y: {Math.round(selectedNode.position.y)}
                </p>
              </div>

              {/* Node ID */}
              <div className={cn(inspectorFieldVariants())}>
                <span className={cn(inspectorLabelVariants())}>Node ID</span>
                <p className="text-[var(--text-xs)] text-[var(--fg-subtle)] font-mono truncate">
                  {selectedNode.id}
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-subtle)] flex items-center justify-center">
                <Sparkle className="h-5 w-5 text-[var(--fg-subtle)]" />
              </div>
              <p className="text-[var(--text-sm)] text-[var(--fg-muted)]">No node selected</p>
              <p className="text-[var(--text-xs)] text-[var(--fg-subtle)] mt-1">
                Click a node to view its properties
              </p>
            </div>
          )}
        </div>
      </aside>

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
