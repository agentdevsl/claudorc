import {
  Controls,
  type Edge,
  type EdgeTypes,
  MiniMap,
  type Node,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { cn } from '@/lib/utils/cn';
import { edgeTypes } from './edges';
import { nodeTypes } from './nodes';
import { type CanvasVariants, canvasVariants } from './styles';

export interface WorkflowCanvasProps {
  /** Nodes to render on the canvas */
  nodes: Node[];
  /** Edges connecting the nodes */
  edges: Edge[];
  /** Callback when nodes change (move, resize, etc.) */
  onNodesChange: OnNodesChange;
  /** Callback when edges change (connect, disconnect, etc.) */
  onEdgesChange: OnEdgesChange;
  /** Callback when a node is clicked */
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  /** Callback when an edge is clicked */
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  /** Current viewport (pan/zoom state) */
  viewport?: Viewport;
  /** Callback when viewport changes */
  onViewportChange?: (viewport: Viewport) => void;
  /** Canvas state variant */
  state?: CanvasVariants['state'];
  /** Optional className for the container */
  className?: string;
  /** Whether the canvas is in read-only mode */
  readOnly?: boolean;
}

/**
 * WorkflowCanvas component renders an interactive node-based workflow editor
 * using ReactFlow. Supports drag-and-drop node placement, edge connections,
 * and pan/zoom navigation.
 */
export function WorkflowCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onEdgeClick,
  viewport,
  onViewportChange,
  state = 'default',
  className,
  readOnly = false,
}: WorkflowCanvasProps): React.JSX.Element {
  return (
    <div className={cn(canvasVariants({ state }), className)} data-testid="workflow-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes as NodeTypes}
        edgeTypes={edgeTypes as EdgeTypes}
        viewport={viewport}
        onViewportChange={onViewportChange}
        fitView
        fitViewOptions={{
          padding: 0.15,
          minZoom: 0.5,
          maxZoom: 1.2,
          includeHiddenNodes: false,
        }}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        minZoom={0.4}
        maxZoom={2}
        defaultEdgeOptions={{
          animated: false,
          type: 'sequential',
          style: { strokeWidth: 1, stroke: 'var(--border-muted)' },
        }}
        proOptions={{
          hideAttribution: true,
        }}
      >
        {/* Clean canvas - no grid dots for cleaner visual */}

        <MiniMap
          position="bottom-right"
          className="!rounded-[var(--radius)] !border !border-[var(--border-default)] !bg-[var(--bg-default)] !shadow-[var(--shadow-md)]"
          maskColor="rgba(13, 17, 23, 0.6)"
          nodeStrokeWidth={3}
          nodeColor={(node) => {
            // Handle both base types and compact types (e.g., 'start' and 'compactStart')
            const nodeType =
              typeof node.data?.nodeType === 'string' ? node.data.nodeType : node.type;
            const t = nodeType ?? '';
            if (t.includes('start') || t.includes('Start')) return 'var(--success-fg)';
            if (t.includes('end') || t.includes('End')) return 'var(--danger-fg)';
            if (t.includes('skill') || t.includes('Skill')) return 'var(--secondary-fg)';
            if (t.includes('context') || t.includes('Context')) return 'var(--attention-fg)';
            if (t.includes('agent') || t.includes('Agent')) return 'var(--accent-fg)';
            return 'var(--fg-muted)';
          }}
          pannable
          zoomable
        />

        <Controls
          position="bottom-left"
          className="!rounded-[var(--radius)] !border !border-[var(--border-default)] !bg-[var(--bg-default)] !shadow-[var(--shadow-md)] [&>button]:!border-[var(--border-default)] [&>button]:!bg-[var(--bg-default)] [&>button]:!text-[var(--fg-muted)] [&>button:hover]:!bg-[var(--bg-subtle)] [&>button:hover]:!text-[var(--fg-default)]"
          showZoom
          showFitView
          showInteractive={!readOnly}
        />
      </ReactFlow>
    </div>
  );
}
