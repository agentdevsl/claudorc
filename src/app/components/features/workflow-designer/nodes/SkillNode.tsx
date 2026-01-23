import { Lightning } from '@phosphor-icons/react';
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
import type { SkillNodeData } from './types';

type SkillNodeType = Node<SkillNodeData, 'skill'>;

/**
 * SkillNode - Sophisticated card representing a skill execution.
 * Features:
 * - Icon + label header row
 * - AI-generated summary/description
 * - Type badge with slash command format
 */
function SkillNodeComponent({ data, selected }: NodeProps<SkillNodeType>): React.JSX.Element {
  const nodeData = data as SkillNodeData;

  return (
    <div className={cn(rectangleNodeVariants({ selected: selected ?? false, nodeType: 'skill' }))}>
      {/* Target handle - top */}
      <Handle
        type="target"
        position={Position.Top}
        className={cn(handleVariants({ type: 'target' }))}
        id="target"
      />

      {/* Header row with icon and label */}
      <div className={cn(nodeHeaderVariants())}>
        <Lightning
          className={cn(nodeIconVariants({ nodeType: 'skill' }))}
          weight="duotone"
          aria-hidden="true"
        />
        <span className={cn(nodeLabelVariants({ nodeType: 'skill' }))} title={nodeData.label}>
          /{nodeData.label || 'skill'}
        </span>
      </div>

      {/* AI Summary / Description */}
      {nodeData.description && (
        <p className={cn(nodeSummaryVariants())} title={nodeData.description}>
          {nodeData.description}
        </p>
      )}

      {/* Type badge and skill ID */}
      <div className="flex items-center gap-[var(--space-2)] mt-[var(--space-1)]">
        <span className={cn(nodeTypeBadgeVariants({ nodeType: 'skill' }))}>Skill</span>
        {nodeData.skillId && nodeData.skillId !== nodeData.label && (
          <span
            className="text-[10px] text-[var(--fg-subtle)] font-mono truncate max-w-[100px]"
            title={nodeData.skillId}
          >
            {nodeData.skillId}
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

export const SkillNode = memo(SkillNodeComponent);
SkillNode.displayName = 'SkillNode';
