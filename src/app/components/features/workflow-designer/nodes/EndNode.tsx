import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import { handleVariants, pillNodeVariants } from './styles';
import type { EndNodeData } from './types';

type EndNodeType = Node<EndNodeData, 'end'>;

/**
 * EndNode - Red rounded pill representing workflow termination.
 * Only has a target handle (top) since it's the end of the flow.
 */
function EndNodeComponent({ data, selected }: NodeProps<EndNodeType>): React.JSX.Element {
  const nodeData = data as EndNodeData;

  return (
    <div className={cn(pillNodeVariants({ selected: selected ?? false, nodeType: 'end' }))}>
      {/* Target handle - top only */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleVariants({ type: 'target' }))}
        id="target"
      />

      <span className="text-base" aria-hidden="true">
        &#9632;
      </span>
      <span className="font-semibold">{nodeData.label || 'End'}</span>
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);
EndNode.displayName = 'EndNode';
