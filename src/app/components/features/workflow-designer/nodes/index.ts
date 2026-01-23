/**
 * Workflow Designer Node Types Registry
 *
 * Custom node components for ReactFlow 12 workflow visualization.
 *
 * Standard Node Types:
 * - start: Green rounded pill for workflow entry point
 * - end: Red rounded pill for workflow termination
 * - skill: Rectangle with book icon for skill execution
 * - command: Rectangle with lightning icon for command execution
 * - agent: Rectangle with robot icon for agent execution (with handoff dots)
 * - conditional: Diamond shape for decision branching
 * - loop: Rectangle with circular arrow for iteration
 * - parallel: Fork shape for parallel execution branches
 *
 * Compact Node Types (v3 design - 32px height pills):
 * - compactStart: Green pill with play icon
 * - compactEnd: Red pill with stop icon
 * - compactCommand: Gold pill with terminal icon + cmd badge
 * - compactSkill: Pink pill with lightning icon + skill badge
 * - compactAgent: Blue pill with robot icon + agent badge
 */

import { AgentNode } from './AgentNode';
import { CommandNode } from './CommandNode';
import { compactNodeTypes } from './CompactNodes';
import { ConditionalNode } from './ConditionalNode';
import { EndNode } from './EndNode';
import { LoopNode } from './LoopNode';
import { ParallelNode } from './ParallelNode';
import { SkillNode } from './SkillNode';
import { StartNode } from './StartNode';

/**
 * Node type registry for ReactFlow (includes both standard and compact nodes)
 *
 * Usage:
 * ```tsx
 * import { nodeTypes } from './nodes';
 *
 * <ReactFlow
 *   nodes={nodes}
 *   edges={edges}
 *   nodeTypes={nodeTypes}
 * />
 * ```
 */
export const nodeTypes = {
  // Standard nodes
  skill: SkillNode,
  command: CommandNode,
  agent: AgentNode,
  conditional: ConditionalNode,
  loop: LoopNode,
  parallel: ParallelNode,
  start: StartNode,
  end: EndNode,
  // Compact nodes (v3 design)
  ...compactNodeTypes,
} as const;

export type NodeType = keyof typeof nodeTypes;

// Re-export standard node components
export { AgentNode } from './AgentNode';
export { CommandNode } from './CommandNode';
// Re-export compact node components (v3 design)
export {
  CompactAgentNode,
  CompactCommandNode,
  CompactEndNode,
  type CompactNodeType,
  CompactSkillNode,
  CompactStartNode,
  compactNodeTypes,
} from './CompactNodes';
export { ConditionalNode } from './ConditionalNode';
export { EndNode } from './EndNode';
export { LoopNode } from './LoopNode';
export { ParallelNode } from './ParallelNode';
export { SkillNode } from './SkillNode';
export { StartNode } from './StartNode';

// Re-export styles for customization
export * from './styles';

// Re-export types
export type {
  AgentNodeData,
  BaseNodeData,
  CommandNodeData,
  ConditionalNodeData,
  EndNodeData,
  LoopNodeData,
  ParallelNodeData,
  SkillNodeData,
  StartNodeData,
  WorkflowNode,
  WorkflowNodeData,
  WorkflowNodeType,
} from './types';
