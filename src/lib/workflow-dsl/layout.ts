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
import type { Position, WorkflowEdge, WorkflowNode } from './types.js';

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
  nodeWidth: 200,
  nodeHeight: 60,
  nodeSpacing: 50,
  layerSpacing: 80,
  edgeRouting: 'ORTHOGONAL',
};

// =============================================================================
// SIMPLE HIERARCHICAL LAYOUT
// =============================================================================

/**
 * Simple hierarchical layout algorithm that works without web workers.
 * Uses topological sorting to arrange nodes in layers.
 */
function simpleHierarchicalLayout(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  opts: Required<LayoutOptions>
): Map<string, Position> {
  const positions = new Map<string, Position>();

  // Build adjacency map
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  const nodeSet = new Set(nodes.map((n) => n.id));

  for (const node of nodes) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }

  for (const edge of edges) {
    if (nodeSet.has(edge.sourceNodeId) && nodeSet.has(edge.targetNodeId)) {
      outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
      incoming.get(edge.targetNodeId)?.push(edge.sourceNodeId);
    }
  }

  // Find layers using topological sort (Kahn's algorithm)
  const layers: string[][] = [];
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    inDegree.set(node.id, incoming.get(node.id)?.length ?? 0);
  }

  // Start with nodes that have no incoming edges
  let currentLayer = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0).map((n) => n.id);

  while (currentLayer.length > 0) {
    layers.push(currentLayer);
    const nextLayer: string[] = [];

    for (const nodeId of currentLayer) {
      for (const targetId of outgoing.get(nodeId) ?? []) {
        const newDegree = (inDegree.get(targetId) ?? 0) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) {
          nextLayer.push(targetId);
        }
      }
    }

    currentLayer = nextLayer;
  }

  // Handle any remaining nodes (cycles or disconnected)
  const assigned = new Set(layers.flat());
  const remaining = nodes.filter((n) => !assigned.has(n.id)).map((n) => n.id);
  if (remaining.length > 0) {
    layers.push(remaining);
  }

  // Calculate positions based on layers
  const isHorizontal = opts.direction === 'LEFT' || opts.direction === 'RIGHT';
  const isReverse = opts.direction === 'UP' || opts.direction === 'LEFT';

  for (let layerIdx = 0; layerIdx < layers.length; layerIdx++) {
    const layer = layers[layerIdx];
    if (!layer) continue;
    const actualLayerIdx = isReverse ? layers.length - 1 - layerIdx : layerIdx;

    for (let nodeIdx = 0; nodeIdx < layer.length; nodeIdx++) {
      const nodeId = layer[nodeIdx];
      if (!nodeId) continue;

      let x: number;
      let y: number;

      if (isHorizontal) {
        x = actualLayerIdx * (opts.nodeWidth + opts.layerSpacing);
        y = nodeIdx * (opts.nodeHeight + opts.nodeSpacing);
      } else {
        x = nodeIdx * (opts.nodeWidth + opts.nodeSpacing);
        y = actualLayerIdx * (opts.nodeHeight + opts.layerSpacing);
      }

      positions.set(nodeId, { x, y });
    }
  }

  return positions;
}

// =============================================================================
// MAIN LAYOUT FUNCTION
// =============================================================================

/**
 * Calculates automatic layout positions for workflow nodes.
 * Uses a simple hierarchical layout algorithm that works in all environments.
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

  // Use simple hierarchical layout (no external dependencies)
  const positions = simpleHierarchicalLayout(nodes, edges, opts);

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
 * Converts WorkflowNode array to ReactFlow Node array.
 *
 * @param nodes - Array of workflow nodes
 * @returns Array of ReactFlow-compatible nodes
 */
export function toReactFlowNodes(nodes: WorkflowNode[]): ReactFlowNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      label: node.label,
      description: node.description,
      metadata: node.metadata,
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

/**
 * Applies layout to workflow and returns ReactFlow-compatible nodes and edges.
 *
 * @param nodes - Array of workflow nodes
 * @param edges - Array of workflow edges
 * @param options - Optional layout configuration
 * @returns Promise resolving to object containing ReactFlow nodes and edges
 */
export async function layoutWorkflowForReactFlow(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: LayoutOptions
): Promise<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] }> {
  const layoutedNodes = await layoutWorkflow(nodes, edges, options);
  return {
    nodes: toReactFlowNodes(layoutedNodes),
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
 */
function mapEdgeType(edgeType: WorkflowEdge['type']): string {
  switch (edgeType) {
    case 'conditional':
      return 'smoothstep';
    case 'handoff':
      return 'step';
    case 'dataflow':
      return 'bezier';
    default:
      return 'default';
  }
}
