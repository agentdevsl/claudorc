/**
 * Workflow Layout Utility
 *
 * Uses ELK (Eclipse Layout Kernel) to automatically calculate positions for
 * workflow nodes based on their edge connections, producing clean hierarchical layouts.
 *
 * Supported algorithms:
 * - Layered: Hierarchical layouts with configurable direction
 * - Force: Force-directed layouts
 * - Box: Grid-based box layouts
 * - Random: Random placement
 */

import type { Edge as ReactFlowEdge, Node as ReactFlowNode } from '@xyflow/react';
import type { LayoutOptions as ElkLayoutOptions, ElkNode } from 'elkjs/lib/elk.bundled.js';
import type { Position, WorkflowEdge, WorkflowNode } from './types.js';

// Lazy-initialize ELK instance to avoid server-side worker issues
let elkInstance: typeof import('elkjs/lib/elk.bundled.js').default.prototype | null = null;

async function getElk(): Promise<typeof import('elkjs/lib/elk.bundled.js').default.prototype> {
  if (!elkInstance) {
    const ELKModule = await import('elkjs/lib/elk.bundled.js');
    elkInstance = new ELKModule.default();
  }
  return elkInstance;
}

// =============================================================================
// LAYOUT OPTIONS
// =============================================================================

export interface LayoutOptions {
  /** Layout algorithm: layered (hierarchical), force, box, random */
  algorithm?: 'layered' | 'force' | 'box' | 'random';
  /** Graph direction: DOWN, UP, LEFT, RIGHT */
  direction?: 'DOWN' | 'UP' | 'LEFT' | 'RIGHT';
  /** Width of each node in pixels */
  nodeWidth?: number;
  /** Height of each node in pixels */
  nodeHeight?: number;
  /** Spacing between nodes */
  nodeSpacing?: number;
  /** Spacing between layers/ranks */
  layerSpacing?: number;
  /** Edge routing: ORTHOGONAL, POLYLINE, SPLINES */
  edgeRouting?: 'ORTHOGONAL' | 'POLYLINE' | 'SPLINES';
}

const DEFAULT_OPTIONS: Required<LayoutOptions> = {
  algorithm: 'layered',
  direction: 'DOWN',
  nodeWidth: 480, // Matches CSS min-width for uniform node sizing
  nodeHeight: 32, // Compact node height
  nodeSpacing: 30, // Horizontal spacing between parallel nodes
  layerSpacing: 45, // Vertical gap between layers
  edgeRouting: 'ORTHOGONAL',
};

// =============================================================================
// ELK LAYOUT
// =============================================================================

/**
 * Converts our layout options to ELK layout options.
 */
function toElkLayoutOptions(opts: Required<LayoutOptions>): ElkLayoutOptions {
  return {
    'elk.algorithm': opts.algorithm,
    'elk.direction': opts.direction,
    // Node spacing
    'elk.spacing.nodeNode': String(opts.nodeSpacing),
    'elk.layered.spacing.nodeNodeBetweenLayers': String(opts.layerSpacing),
    // Edge routing
    'elk.edgeRouting': opts.edgeRouting,
    // Crossing minimization
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    // Node placement - LINEAR_SEGMENTS for better vertical alignment
    'elk.layered.nodePlacement.strategy': 'LINEAR_SEGMENTS',
    // Spacing
    'elk.layered.spacing.edgeNodeBetweenLayers': String(opts.layerSpacing),
    'elk.layered.spacing.edgeEdgeBetweenLayers': String(opts.layerSpacing / 2),
    // Preserve model order - important for sequential workflows
    'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
    // Merge edges for cleaner look
    'elk.layered.mergeEdges': 'true',
    // Center the graph
    'elk.contentAlignment': 'H_CENTER V_TOP',
  };
}

/**
 * Uses ELK to calculate optimal node positions.
 * Always uses ELK for consistent professional layouts with auto-centering.
 */
async function elkLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  opts: Required<LayoutOptions>
): Promise<Map<string, Position>> {
  const positions = new Map<string, Position>();

  if (nodes.length === 0) {
    return positions;
  }

  // Always use ELK for layout
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: toElkLayoutOptions(opts),
    children: nodes.map((node) => ({
      id: node.id,
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    })),
    edges: edges
      .filter((edge) => {
        // Only include edges where both source and target exist
        const nodeIds = new Set(nodes.map((n) => n.id));
        return nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId);
      })
      .map((edge) => ({
        id: edge.id,
        sources: [edge.sourceNodeId],
        targets: [edge.targetNodeId],
      })),
  };

  try {
    const elk = await getElk();
    const layoutedGraph = await elk.layout(elkGraph);

    // Extract positions from layouted graph
    for (const child of layoutedGraph.children ?? []) {
      if (child.x !== undefined && child.y !== undefined) {
        positions.set(child.id, { x: child.x, y: child.y });
      }
    }

    // Post-process: normalize positions to start at x=0
    normalizePositions(positions);
  } catch (error) {
    console.error('[layoutWorkflow] ELK layout failed:', error);
    // Fall back to simple positioning
    nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: 0,
        y: index * (opts.nodeHeight + opts.layerSpacing),
      });
    });
  }

  return positions;
}

/**
 * Normalizes node positions to start at x=0.
 * With uniform node widths (enforced by CSS min-width), handles align automatically.
 */
function normalizePositions(positions: Map<string, Position>): void {
  if (positions.size === 0) return;

  // Find min x to shift all nodes to start at x=0
  let minX = Infinity;
  for (const pos of positions.values()) {
    minX = Math.min(minX, pos.x);
  }

  // Shift all nodes so minimum x is 0
  for (const [id, pos] of positions) {
    positions.set(id, { x: pos.x - minX, y: pos.y });
  }
}

// =============================================================================
// MAIN LAYOUT FUNCTION
// =============================================================================

/**
 * Calculates automatic layout positions for workflow nodes.
 * Uses ELK (Eclipse Layout Kernel) for professional-quality hierarchical layouts.
 *
 * @param nodes - Array of workflow nodes to layout
 * @param edges - Array of workflow edges defining connections
 * @param options - Optional layout configuration
 * @returns Promise resolving to new array of nodes with updated positions
 *
 * @example
 * ```ts
 * const layoutedNodes = await layoutWorkflow(workflow.nodes, workflow.edges, {
 *   direction: 'RIGHT',
 *   algorithm: 'layered',
 * });
 * ```
 */
export async function layoutWorkflow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: LayoutOptions
): Promise<WorkflowNode[]> {
  if (nodes.length === 0) {
    return [];
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Use ELK for professional layout
  const positions = await elkLayout(nodes, edges, opts);

  return nodes.map((node) => {
    const newPosition = positions.get(node.id);
    if (!newPosition) {
      console.warn(`Node "${node.id}" was not found in layout output. Using original position.`);
    }
    return {
      ...node,
      position: newPosition ?? node.position,
    };
  });
}

// =============================================================================
// REACTFLOW CONVERSION HELPERS
// =============================================================================

/**
 * Maps standard node types to compact node types for the v3 pill design.
 * Note: A similar function exists in src/app/components/features/workflow-designer/index.tsx.
 */
function mapToCompactNodeType(type: WorkflowNode['type']): string {
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
      // Log that this type has no compact equivalent (e.g., conditional, loop, parallel)
      console.warn(
        `[layoutWorkflow] Node type "${type}" has no compact variant - using as-is. Node may render with default styling.`
      );
      return type;
  }
}

export interface ToReactFlowNodesOptions {
  /** Use compact node types (v3 design) - default: true */
  useCompactNodes?: boolean;
}

/**
 * Converts WorkflowNode array to ReactFlow Node array.
 *
 * @param nodes - Array of workflow nodes
 * @param options - Conversion options
 * @returns Array of ReactFlow-compatible nodes
 */
export function toReactFlowNodes(
  nodes: WorkflowNode[],
  options: ToReactFlowNodesOptions = {}
): ReactFlowNode[] {
  const { useCompactNodes = true } = options;

  return nodes.map((node, index) => ({
    id: node.id,
    type: useCompactNodes ? mapToCompactNodeType(node.type) : node.type,
    position: node.position,
    data: {
      label: node.label,
      description: node.description,
      metadata: node.metadata,
      // Node index for staggered animation
      nodeIndex: index,
      // Original node type for reference
      nodeType: node.type,
      // Spread node-specific properties
      ...extractNodeSpecificData(node),
    },
  }));
}

/**
 * Converts WorkflowEdge array to ReactFlow Edge array.
 *
 * @param edges - Array of workflow edges
 * @returns Array of ReactFlow-compatible edges
 */
export function toReactFlowEdges(edges: WorkflowEdge[]): ReactFlowEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: mapEdgeType(edge.type),
    label: edge.label,
    data: {
      edgeType: edge.type,
      metadata: edge.metadata,
      // Spread edge-specific properties
      ...extractEdgeSpecificData(edge),
    },
  }));
}

/**
 * Converts ReactFlow nodes back to WorkflowNode array.
 * Note: This requires the original node data to preserve type-specific properties.
 *
 * @param reactFlowNodes - Array of ReactFlow nodes
 * @param originalNodes - Original workflow nodes for reference
 * @returns Array of workflow nodes with updated positions
 */
export function fromReactFlowNodes(
  reactFlowNodes: ReactFlowNode[],
  originalNodes: WorkflowNode[]
): WorkflowNode[] {
  const originalNodeMap = new Map(originalNodes.map((n) => [n.id, n]));

  return reactFlowNodes.map((rfNode) => {
    const original = originalNodeMap.get(rfNode.id);
    if (!original) {
      throw new Error(`Original node not found for id: ${rfNode.id}`);
    }

    return {
      ...original,
      position: {
        x: rfNode.position.x,
        y: rfNode.position.y,
      },
    };
  });
}

export interface LayoutWorkflowForReactFlowOptions extends LayoutOptions {
  /** Use compact node types (v3 design) - default: true */
  useCompactNodes?: boolean;
}

/**
 * Applies layout to workflow and returns ReactFlow-compatible nodes and edges.
 *
 * @param nodes - Array of workflow nodes
 * @param edges - Array of workflow edges
 * @param options - Optional layout and conversion configuration
 * @returns Promise resolving to object containing ReactFlow nodes and edges
 */
export async function layoutWorkflowForReactFlow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: LayoutWorkflowForReactFlowOptions
): Promise<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] }> {
  const { useCompactNodes = true, ...layoutOptions } = options ?? {};
  const layoutedNodes = await layoutWorkflow(nodes, edges, layoutOptions);
  return {
    nodes: toReactFlowNodes(layoutedNodes, { useCompactNodes }),
    edges: toReactFlowEdges(edges),
  };
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

/**
 * Extracts node-specific data based on node type.
 */
function extractNodeSpecificData(node: WorkflowNode): Record<string, unknown> {
  switch (node.type) {
    case 'skill':
      return {
        skillId: node.skillId,
        skillName: node.skillName,
        inputs: node.inputs,
        outputs: node.outputs,
      };
    case 'command':
      return {
        command: node.command,
        args: node.args,
        workingDirectory: node.workingDirectory,
        environment: node.environment,
        timeout: node.timeout,
      };
    case 'agent':
      return {
        agentId: node.agentId,
        agentName: node.agentName,
        systemPrompt: node.systemPrompt,
        model: node.model,
        maxTurns: node.maxTurns,
        temperature: node.temperature,
        allowedTools: node.allowedTools,
        handoffs: node.handoffs,
      };
    case 'conditional':
      return {
        expression: node.expression,
        branches: node.branches,
        defaultBranch: node.defaultBranch,
      };
    case 'loop':
      return {
        iteratorVariable: node.iteratorVariable,
        collection: node.collection,
        maxIterations: node.maxIterations,
        breakCondition: node.breakCondition,
        bodyNodeIds: node.bodyNodeIds,
      };
    case 'parallel':
      return {
        branchNodeIds: node.branchNodeIds,
        waitForAll: node.waitForAll,
        maxConcurrency: node.maxConcurrency,
      };
    case 'start':
      return {
        inputs: node.inputs,
      };
    case 'end':
      return {
        outputs: node.outputs,
      };
    default:
      return {};
  }
}

/**
 * Extracts edge-specific data based on edge type.
 */
function extractEdgeSpecificData(edge: WorkflowEdge): Record<string, unknown> {
  switch (edge.type) {
    case 'handoff':
      return {
        context: edge.context,
        preserveHistory: edge.preserveHistory,
      };
    case 'dataflow':
      return {
        sourceOutput: edge.sourceOutput,
        targetInput: edge.targetInput,
        transform: edge.transform,
      };
    case 'conditional':
      return {
        condition: edge.condition,
        priority: edge.priority,
      };
    default:
      return {};
  }
}

/**
 * Maps workflow edge types to ReactFlow edge types.
 * Uses 'straight' for compact vertical layouts.
 */
function mapEdgeType(_edgeType: WorkflowEdge['type']): string {
  // Use straight edges for compact layout - curves add visual bulk
  return 'straight';
}
