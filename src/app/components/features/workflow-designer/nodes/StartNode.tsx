import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import { handleVariants, pillNodeVariants } from './styles';
import type { StartNodeData } from './types';

type StartNodeType = Node<StartNodeData, 'start'>;

/**
 * StartNode - Green rounded pill representing workflow entry point.
 * Only has a source handle (bottom) since it's the beginning of the flow.
 */
function StartNodeComponent({ data, selected }: NodeProps<StartNodeType>): React.JSX.Element {
  const nodeData = data as StartNodeData;

  return (
    <div className={cn(pillNodeVariants({ selected: selected ?? false, nodeType: 'start' }))}>
      <span className="text-base" aria-hidden="true">
        &#9654;
      </span>
      <span className="font-semibold">{nodeData.label || 'Start'}</span>

      {/* Source handle - bottom only */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleVariants({ type: 'source' }))}
        id="source"
      />
    </div>
  );
}

export const StartNode = memo(StartNodeComponent);
StartNode.displayName = 'StartNode';
