/**
 * Workflow Designer Node Types Registry
 *
 * Custom node components for ReactFlow 12 workflow visualization.
 *
 * Node Types:
 * - start: Green rounded pill for workflow entry point
 * - end: Red rounded pill for workflow termination
 * - skill: Rectangle with book icon for skill execution
 * - command: Rectangle with lightning icon for command execution
 * - agent: Rectangle with robot icon for agent execution (with handoff dots)
 * - conditional: Diamond shape for decision branching
 * - loop: Rectangle with circular arrow for iteration
 * - parallel: Fork shape for parallel execution branches
 */

import { AgentNode } from './AgentNode';
import { CommandNode } from './CommandNode';
import { ConditionalNode } from './ConditionalNode';
import { EndNode } from './EndNode';
import { LoopNode } from './LoopNode';
import { ParallelNode } from './ParallelNode';
import { SkillNode } from './SkillNode';
import { StartNode } from './StartNode';

/**
 * Node type registry for ReactFlow
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
  skill: SkillNode,
  command: CommandNode,
  agent: AgentNode,
  conditional: ConditionalNode,
  loop: LoopNode,
  parallel: ParallelNode,
  start: StartNode,
  end: EndNode,
} as const;

export type NodeType = keyof typeof nodeTypes;

export { AgentNode } from './AgentNode';
export { CommandNode } from './CommandNode';
export { ConditionalNode } from './ConditionalNode';
export { EndNode } from './EndNode';
export { LoopNode } from './LoopNode';
export { ParallelNode } from './ParallelNode';
// Re-export individual components
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
