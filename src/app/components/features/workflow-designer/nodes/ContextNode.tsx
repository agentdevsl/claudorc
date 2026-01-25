import { Terminal } from '@phosphor-icons/react';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  handleVariants,
  nodeHeaderVariants,
  nodeIconVariants,
  nodeLabelVariants,
  nodeSummaryVariants,
  nodeTypeBadgeVariants,
  rectangleNodeVariants,
} from './styles';
import type { ContextNodeData } from './types';

type ContextNodeType = Node<ContextNodeData, 'context'>;

/**
 * ContextNode - Sophisticated card representing context/prompting content.
 * Features:
 * - Icon + label header row
 * - AI-generated summary/description
 * - Type badge for context identification
 */
function ContextNodeComponent({ data, selected }: NodeProps<ContextNodeType>): React.JSX.Element {
  const nodeData = data as ContextNodeData;

  return (
    <div
      className={cn(rectangleNodeVariants({ selected: selected ?? false, nodeType: 'context' }))}
    >
      {/* Target handle - top */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleVariants({ type: 'target' }))}
        id="target"
      />

      {/* Header row with icon and label */}
      <div className={cn(nodeHeaderVariants())}>
        <Terminal
          className={cn(nodeIconVariants({ nodeType: 'context' }))}
          weight="duotone"
          aria-hidden="true"
        />
        <span className={cn(nodeLabelVariants({ nodeType: 'context' }))} title={nodeData.label}>
          {nodeData.label || 'context'}
        </span>
      </div>

      {/* AI Summary / Description */}
      {nodeData.description && (
        <p className={cn(nodeSummaryVariants())} title={nodeData.description}>
          {nodeData.description}
        </p>
      )}

      {/* Type badge and content */}
      <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
        <span className={cn(nodeTypeBadgeVariants({ nodeType: 'context' }))}>Context</span>
        {nodeData.content && nodeData.content !== nodeData.label && (
          <span
            className="text-[10px] text-[var(--fg-subtle)] font-mono truncate max-w-[100px]"
            title={nodeData.content}
          >
            {nodeData.content}
          </span>
        )}
      </div>

      {/* Source handle - bottom */}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn(handleVariants({ type: 'source' }))}
        id="source"
      />
    </div>
  );
}

export const ContextNode = memo(ContextNodeComponent);
ContextNode.displayName = 'ContextNode';
