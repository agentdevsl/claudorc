import { EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TerraformEdgeData extends Record<string, unknown> {
  edgeType: 'explicit' | 'implicit';
  outputs?: string;
}

/** SVG marker definitions — rendered once inside the ReactFlow SVG layer. */
export function TerraformEdgeMarkers(): React.JSX.Element {
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        <marker
          id="tf-arrow-explicit"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,1 L7,4 L0,7" fill="none" stroke="#58a6ff" strokeWidth="1.2" />
        </marker>
        <marker
          id="tf-arrow-implicit"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,1 L7,4 L0,7" fill="none" stroke="#6e7681" strokeWidth="1.2" />
        </marker>
      </defs>
    </svg>
  );
}

function TerraformDependencyEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as TerraformEdgeData | undefined;
  const isExplicit = edgeData?.edgeType === 'explicit';
  const outputs = edgeData?.outputs;

  return (
    <>
      {/* Glow layer for explicit edges */}
      {isExplicit && (
        <path
          d={edgePath}
          fill="none"
          stroke="#58a6ff"
          strokeWidth={6}
          strokeLinecap="round"
          opacity={0.08}
          className="react-flow__edge-path"
        />
      )}
      {/* Main edge path */}
      <path
        id={id}
        d={edgePath}
        fill="none"
        stroke={isExplicit ? '#58a6ff' : '#6e7681'}
        strokeWidth={isExplicit ? 2 : 1.5}
        strokeDasharray={isExplicit ? undefined : '6 4'}
        strokeLinecap="round"
        markerEnd={isExplicit ? 'url(#tf-arrow-explicit)' : 'url(#tf-arrow-implicit)'}
        className="react-flow__edge-path"
        style={
          isExplicit
            ? undefined
            : {
                animation: 'tf-dash-flow 1.5s linear infinite',
              }
        }
      />
      {outputs && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'pointer-events-all absolute -translate-x-1/2 -translate-y-1/2 transform',
              'rounded-md border border-border-subtle bg-surface/95 px-1.5 py-0.5',
              'font-mono text-[10px] leading-tight text-fg-muted shadow-sm',
              'max-w-[200px] truncate'
            )}
            style={{ left: labelX, top: labelY }}
            title={outputs}
          >
            {outputs}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const TerraformDependencyEdge = memo(TerraformDependencyEdgeComponent);
TerraformDependencyEdge.displayName = 'TerraformDependencyEdge';
