import { BaseEdge, EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react';
import { cva } from 'class-variance-authority';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';

const edgeStyles = cva('transition-all duration-200', {
  variants: {
    selected: {
      true: 'stroke-accent stroke-[2.5px]',
      false: 'stroke-fg-subtle stroke-[2px]',
    },
  },
  defaultVariants: {
    selected: false,
  },
});

const labelStyles = cva(
  'absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-all rounded-md px-2.5 py-1 text-xs font-medium shadow-md border transition-colors duration-200',
  {
    variants: {
      selected: {
        true: 'bg-accent text-fg border-accent-hover',
        false: 'bg-surface-raised text-fg-muted border-border',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

const dotStyles = cva(
  'absolute w-2.5 h-2.5 rounded-full transform -translate-x-1/2 -translate-y-1/2 transition-colors duration-200',
  {
    variants: {
      selected: {
        true: 'bg-accent',
        false: 'bg-fg-subtle',
      },
    },
    defaultVariants: {
      selected: false,
    },
  }
);

export interface HandoffEdgeData extends Record<string, unknown> {
  label?: string;
  agentFrom?: string;
  agentTo?: string;
}

function HandoffEdgeComponent({
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

  // Calculate dot position at the midpoint of the edge
  const dotX = (sourceX + targetX) / 2;
  const dotY = (sourceY + targetY) / 2;

  const edgeData = data as HandoffEdgeData | undefined;
  const label =
    edgeData?.label ||
    (edgeData?.agentFrom && edgeData?.agentTo
      ? `${edgeData.agentFrom} -> ${edgeData.agentTo}`
      : undefined);

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
      {/* Circle marker at midpoint */}
      <EdgeLabelRenderer>
        <div
          className={cn(dotStyles({ selected: selected ?? false }))}
          style={{
            left: dotX,
            top: dotY,
          }}
        />
      </EdgeLabelRenderer>
      {/* Label with background */}
      {label && (
        <EdgeLabelRenderer>
          <div
            className={cn(labelStyles({ selected: selected ?? false }))}
            style={{
              left: labelX,
              top: labelY - 16, // Position label above the dot
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const HandoffEdge = memo(HandoffEdgeComponent);
HandoffEdge.displayName = 'HandoffEdge';
