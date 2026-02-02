import { GitBranch } from '@phosphor-icons/react';
import {
  ReactFlow,
  type Edge as ReactFlowEdge,
  type Node as ReactFlowNode,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ElkNode } from 'elkjs/lib/elk.bundled.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { parseHclDependencies, type TerraformGraph } from '@/lib/terraform/parse-hcl-dependencies';
import { getElk } from '@/lib/workflow-dsl/layout';
import { useTerraform } from './terraform-context';
import { TerraformDependencyEdge, TerraformEdgeMarkers } from './terraform-dependency-edge';
import { TerraformModuleNode } from './terraform-module-node';

const nodeTypes = { terraformModule: TerraformModuleNode };
const edgeTypes = { terraformDependency: TerraformDependencyEdge };

const NODE_WIDTH = 200;
const NODE_HEIGHT = 32;

async function layoutGraph(
  graph: TerraformGraph
): Promise<{ nodes: ReactFlowNode[]; edges: ReactFlowEdge[] }> {
  if (graph.nodes.length === 0) return { nodes: [], edges: [] };

  const elk = await getElk();
  const elkGraph: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '80',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.edgeRouting': 'SPLINES',
      'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
      'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
      'elk.contentAlignment': 'H_CENTER V_TOP',
      'elk.layered.mergeEdges': 'false',
      'elk.spacing.edgeNode': '40',
      'elk.layered.spacing.edgeEdgeBetweenLayers': '25',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
    },
    children: graph.nodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    })),
    edges: graph.edges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  };

  const layouted = await elk.layout(elkGraph);
  const children = layouted.children ?? [];

  const rfNodes: ReactFlowNode[] = children
    .map((child: ElkNode, index: number) => {
      const graphNode = graph.nodes.find((n) => n.id === child.id);
      if (!graphNode) return undefined;
      return {
        id: child.id,
        type: 'terraformModule' as const,
        position: { x: child.x ?? 0, y: child.y ?? 0 },
        data: {
          label: graphNode.label,
          provider: graphNode.provider,
          confidence: graphNode.confidence,
          nodeIndex: index,
        },
        draggable: false,
        connectable: false,
      };
    })
    .filter((n: ReactFlowNode | undefined): n is ReactFlowNode => n !== undefined);

  const rfEdges: ReactFlowEdge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: 'source',
    targetHandle: 'target',
    type: 'terraformDependency',
    data: {
      edgeType: e.type,
      outputs: e.label,
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function DiagramInner(): React.JSX.Element {
  const { generatedCode, matchedModules } = useTerraform();
  const [nodes, setNodes] = useState<ReactFlowNode[]>([]);
  const [edges, setEdges] = useState<ReactFlowEdge[]>([]);
  const [isEmpty, setIsEmpty] = useState(true);
  const layoutInFlight = useRef(false);

  const graph = useMemo(() => {
    if (!generatedCode) return null;
    return parseHclDependencies(generatedCode, matchedModules);
  }, [generatedCode, matchedModules]);

  const runLayout = useCallback(async (g: TerraformGraph) => {
    if (layoutInFlight.current) return;
    layoutInFlight.current = true;
    try {
      const result = await layoutGraph(g);
      setNodes(result.nodes);
      setEdges(result.edges);
      setIsEmpty(result.nodes.length === 0);
    } catch (err) {
      console.error('[TerraformDependencyDiagram] Layout error:', err);
      setIsEmpty(true);
    } finally {
      layoutInFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!graph || graph.nodes.length === 0) {
      setNodes([]);
      setEdges([]);
      setIsEmpty(true);
      return;
    }
    void runLayout(graph);
  }, [graph, runLayout]);

  if (!generatedCode || isEmpty) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-emphasis">
          <GitBranch className="h-6 w-6 text-fg-subtle" />
        </div>
        <p className="text-sm text-fg-muted">
          {generatedCode
            ? 'No module dependencies detected in the generated code.'
            : 'Module dependencies will appear here after code generation.'}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full w-full animate-fade-in">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        panOnDrag
        zoomOnScroll
        zoomOnPinch
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <TerraformEdgeMarkers />
      </ReactFlow>
    </div>
  );
}

export function TerraformDependencyDiagram(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <DiagramInner />
    </ReactFlowProvider>
  );
}
