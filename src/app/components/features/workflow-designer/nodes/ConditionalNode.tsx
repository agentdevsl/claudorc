import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import { diamondNodeVariants, handleVariants } from './styles';
import type { ConditionalNodeData } from './types';

type ConditionalNodeType = Node<ConditionalNodeData, 'conditional'>;

/**
 * ConditionalNode - Diamond shape representing a decision branch.
 * Has target handle at top and two source handles for true/false branches.
 */
function ConditionalNodeComponent({
  data,
  selected,
}: NodeProps<ConditionalNodeType>): React.JSX.Element {
  const nodeData = data as ConditionalNodeData;

  return (
    <div className="relative">
      {/* Diamond container */}
      <div className={cn(diamondNodeVariants({ selected: selected ?? false }))}>
        {/* Inner content rotated back to normal */}
        <div className="-rotate-45 flex flex-col items-center justify-center gap-0.5">
          <span className="text-lg text-fg-muted" aria-hidden="true">
            &#10067;
          </span>
          <span
            className="text-[10px] font-medium text-fg truncate max-w-[60px]"
            title={nodeData.label}
          >
            {nodeData.label || 'Condition'}
          </span>
        </div>
      </div>

      {/* Target handle - top */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleVariants({ type: 'target' }), 'top-[-6px] left-1/2 -translate-x-1/2')}
        id="target"
        style={{ top: -6 }}
      />

      {/* Source handle - left (false branch) */}
      <Handle
        type="source"
        position={Position.Left}
        className={cn(handleVariants({ type: 'source' }), 'left-[-6px] top-1/2 -translate-y-1/2')}
        id="false"
        style={{ left: -6 }}
      />

      {/* Source handle - right (true branch) */}
      <Handle
        type="source"
        position={Position.Right}
        className={cn(handleVariants({ type: 'source' }), 'right-[-6px] top-1/2 -translate-y-1/2')}
        id="true"
        style={{ right: -6 }}
      />

      {/* Branch labels */}
      <span className="absolute -left-10 top-1/2 -translate-y-1/2 text-[10px] text-danger font-medium">
        {nodeData.falseLabel || 'No'}
      </span>
      <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-[10px] text-success font-medium">
        {nodeData.trueLabel || 'Yes'}
      </span>
    </div>
  );
}

export const ConditionalNode = memo(ConditionalNodeComponent);
ConditionalNode.displayName = 'ConditionalNode';
