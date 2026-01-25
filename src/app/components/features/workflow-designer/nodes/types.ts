import type { Node } from '@xyflow/react';

/**
 * Base node data shared by all workflow nodes.
 * Extends Record<string, unknown> for ReactFlow v12 compatibility.
 */
export interface BaseNodeData extends Record<string, unknown> {
  /** Discriminant property for node type (optional for backward compat) */
  nodeType?: string;
  /** Display label for the node */
  label: string;
  /** Optional description */
  description?: string;
}

/**
 * Skill node data
 */
export interface SkillNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'skill';
  /** Skill identifier */
  skillId?: string;
}

/**
 * Context node data
 */
export interface ContextNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'context';
  /** Context content */
  content?: string;
  /** Optional arguments for templating */
  args?: string[];
}

/**
 * Agent node data
 */
export interface AgentNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'agent';
  /** Agent configuration ID */
  agentConfigId?: string;
  /** Whether this agent can hand off to others */
  canHandoff?: boolean;
}

/**
 * Conditional node data
 */
export interface ConditionalNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'conditional';
  /** Condition expression */
  condition?: string;
  /** True branch label */
  trueLabel?: string;
  /** False branch label */
  falseLabel?: string;
}

/**
 * Loop node data
 */
export interface LoopNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'loop';
  /** Maximum iterations */
  maxIterations?: number;
  /** Loop condition */
  condition?: string;
}

/**
 * Parallel node data
 */
export interface ParallelNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'parallel';
  /** Number of parallel branches */
  branchCount?: number;
}

/**
 * Start node data
 */
export interface StartNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'start';
  /** Input parameters schema */
  inputSchema?: Record<string, unknown>;
}

/**
 * End node data
 */
export interface EndNodeData extends BaseNodeData {
  /** Discriminant property */
  nodeType: 'end';
  /** Output mapping */
  outputMapping?: Record<string, string>;
}

/**
 * Union type of all workflow node data types
 */
export type WorkflowNodeData =
  | SkillNodeData
  | ContextNodeData
  | AgentNodeData
  | ConditionalNodeData
  | LoopNodeData
  | ParallelNodeData
  | StartNodeData
  | EndNodeData;

/**
 * Workflow node type identifiers
 */
export type WorkflowNodeType =
  | 'skill'
  | 'context'
  | 'agent'
  | 'conditional'
  | 'loop'
  | 'parallel'
  | 'start'
  | 'end';

/**
 * Typed workflow node
 */
export type WorkflowNode<T extends WorkflowNodeData = WorkflowNodeData> = Node<T>;
