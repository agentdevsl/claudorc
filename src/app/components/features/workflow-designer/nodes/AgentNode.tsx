import { Robot } from '@phosphor-icons/react';
import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { memo } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  handleVariants,
  handoffDotVariants,
  nodeHeaderVariants,
  nodeIconVariants,
  nodeLabelVariants,
  nodeSummaryVariants,
  nodeTypeBadgeVariants,
  rectangleNodeVariants,
} from './styles';
import type { AgentNodeData } from './types';

type AgentNodeType = Node<AgentNodeData, 'agent'>;

/**
 * AgentNode - Sophisticated card representing an agent execution.
 * Features:
 * - Icon + label header row
 * - AI-generated summary/description
 * - Type badge
 * - Handoff indicators for agent-to-agent communication
 */
function AgentNodeComponent({ data, selected }: NodeProps<AgentNodeType>): React.JSX.Element {
  const nodeData = data as AgentNodeData;
  const canHandoff = nodeData.canHandoff ?? false;

  return (
    <div
      className={cn(
        rectangleNodeVariants({ selected: selected ?? false, nodeType: 'agent' }),
        'relative'
      )}
    >
      {/* Target handle - top */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleVariants({ type: 'target' }))}
        id="target"
      />

      {/* Handoff dots for agent-to-agent communication */}
      {canHandoff && (
        <>
          <div
            className={cn(handoffDotVariants({ position: 'left' }))}
            title="Can receive handoff"
          />
          <div
            className={cn(handoffDotVariants({ position: 'right' }))}
            title="Can handoff to agents"
          />
        </>
      )}

      {/* Header row with icon and label */}
      <div className={cn(nodeHeaderVariants())}>
        <Robot
          className={cn(nodeIconVariants({ nodeType: 'agent' }))}
          weight="duotone"
          aria-hidden="true"
        />
        <span className={cn(nodeLabelVariants({ nodeType: 'agent' }))} title={nodeData.label}>
          {nodeData.label || 'Agent'}
        </span>
      </div>

      {/* AI Summary / Description */}
      {nodeData.description && (
        <p className={cn(nodeSummaryVariants())} title={nodeData.description}>
          {nodeData.description}
        </p>
      )}

      {/* Type badge and config ID */}
      <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
        <span className={cn(nodeTypeBadgeVariants({ nodeType: 'agent' }))}>Agent</span>
        {nodeData.agentConfigId && (
          <span
            className="text-[10px] text-[var(--fg-subtle)] font-mono truncate max-w-[100px]"
            title={nodeData.agentConfigId}
          >
            {nodeData.agentConfigId}
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

export const AgentNode = memo(AgentNodeComponent);
AgentNode.displayName = 'AgentNode';
