import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { cva } from 'class-variance-authority';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';

const edgeStyles = cva('transition-all duration-200', {
  variants: {
    selected: {
      true: 'stroke-accent stroke-[2px]',
      false: 'stroke-fg-muted stroke-[1.5px]',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

export interface DataflowEdgeData extends Record<string, unknown> {
  label?: string;
  dataType?: string;
}

function DataflowEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const edgeData = data as DataflowEdgeData | undefined;
  const label = edgeData?.label || edgeData?.dataType;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(edgeStyles({ selected: selected ?? false }))}
        style={{
          strokeDasharray: '6 4',
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-all',
              'rounded px-2 py-0.5 text-xs font-medium italic',
              'bg-surface/90 border border-border-subtle',
              selected ? 'text-accent' : 'text-fg-muted'
            )}
            style={{
              left: labelX,
              top: labelY,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DataflowEdge = memo(DataflowEdgeComponent);
DataflowEdge.displayName = 'DataflowEdge';
