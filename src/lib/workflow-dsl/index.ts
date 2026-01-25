/**
 * Workflow DSL Module
 *
 * Provides types, schemas, and utilities for defining and validating
 * workflow definitions that orchestrate skills, commands, and agents.
 */

// AI prompts for workflow generation
export {
  createWorkflowAnalysisPrompt,
  createWorkflowFromDescriptionPrompt,
  createWorkflowMergePrompt,
  createWorkflowValidationPrompt,
  WORKFLOW_GENERATION_SYSTEM_PROMPT,
} from './ai-prompts.js';
// Layout utilities
export * from './layout.js';
// Types and Zod schemas
export {
  type AgentNode,
  agentNodeSchema,
  type BaseEdge,
  type BaseNode,
  baseEdgeSchema,
  baseNodeSchema,
  type ConditionalBranch,
  type ConditionalEdge,
  type ConditionalNode,
  type ContextNode,
  conditionalBranchSchema,
  conditionalEdgeSchema,
  conditionalNodeSchema,
  contextNodeSchema,
  createEdgeId,
  createNodeId,
  type DataflowEdge,
  dataflowEdgeSchema,
  type EdgeType,
  type EndNode,
  // Edge types
  edgeTypeSchema,
  endNodeSchema,
  type Handoff,
  type HandoffEdge,
  handoffEdgeSchema,
  handoffSchema,
  type LoopNode,
  loopNodeSchema,
  type NodeType,
  // Node types
  nodeTypeSchema,
  type ParallelNode,
  type Position,
  parallelNodeSchema,
  positionSchema,
  type SequentialEdge,
  type SkillNode,
  type StartNode,
  sequentialEdgeSchema,
  skillNodeSchema,
  startNodeSchema,
  type Viewport,
  // Validation and helpers
  validateWorkflowStructure,
  viewportSchema,
  type Workflow,
  type WorkflowEdge,
  type WorkflowNode,
  type WorkflowStatus,
  workflowEdgeSchema,
  workflowNodeSchema,
  workflowSchema,
  // Workflow document
  workflowStatusSchema,
} from './types.js';
