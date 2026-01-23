import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { cva } from 'class-variance-authority';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';

const edgeStyles = cva('transition-all duration-200', {
  variants: {
    selected: {
      true: 'stroke-accent stroke-[2.5px]',
      false: 'stroke-fg-muted stroke-[1.5px]',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

export interface SequentialEdgeData extends Record<string, unknown> {
  label?: string;
  condition?: string;
}

function SequentialEdgeComponent({
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

  const edgeData = data as SequentialEdgeData | undefined;
  const label = edgeData?.label || edgeData?.condition;

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        className={cn(edgeStyles({ selected: selected ?? false }))}
        style={{
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
        }}
      />
      {label && (
        <EdgeLabelRenderer>
          <div
            className={cn(
              'absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-all',
              'rounded px-2 py-0.5 text-xs font-medium',
              'bg-surface border border-border shadow-sm',
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

export const SequentialEdge = memo(SequentialEdgeComponent);
SequentialEdge.displayName = 'SequentialEdge';
