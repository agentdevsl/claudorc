import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';

// =============================================================================
// NODE TYPES
// =============================================================================

export const nodeTypeSchema = z.enum([
  'skill',
  'command',
  'agent',
  'conditional',
  'loop',
  'parallel',
  'start',
  'end',
]);

export type NodeType = z.infer<typeof nodeTypeSchema>;

// Position schema for node placement
export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export type Position = z.infer<typeof positionSchema>;

// -----------------------------------------------------------------------------
// Base Node Schema
// -----------------------------------------------------------------------------

export const baseNodeSchema = z.object({
  id: z.string().min(1),
  type: nodeTypeSchema,
  label: z.string().min(1),
  position: positionSchema,
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseNode = z.infer<typeof baseNodeSchema>;

// -----------------------------------------------------------------------------
// Skill Node
// -----------------------------------------------------------------------------

export const skillNodeSchema = baseNodeSchema.extend({
  type: z.literal('skill'),
  skillId: z.string().min(1),
  skillName: z.string().min(1),
  inputs: z.record(z.string(), z.unknown()).optional(),
  outputs: z.array(z.string()).optional(),
});

export type SkillNode = z.infer<typeof skillNodeSchema>;

// -----------------------------------------------------------------------------
// Command Node
// -----------------------------------------------------------------------------

export const commandNodeSchema = baseNodeSchema.extend({
  type: z.literal('command'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  workingDirectory: z.string().optional(),
  environment: z.record(z.string(), z.string()).optional(),
  timeout: z.number().positive().optional(),
});

export type CommandNode = z.infer<typeof commandNodeSchema>;

// -----------------------------------------------------------------------------
// Agent Handoff Schema
// -----------------------------------------------------------------------------

export const handoffSchema = z.object({
  targetAgentId: z.string().min(1),
  condition: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export type Handoff = z.infer<typeof handoffSchema>;

// -----------------------------------------------------------------------------
// Agent Node
// -----------------------------------------------------------------------------

export const agentNodeSchema = baseNodeSchema.extend({
  type: z.literal('agent'),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  maxTurns: z.number().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  allowedTools: z.array(z.string()).optional(),
  handoffs: z.array(handoffSchema).optional(),
});

export type AgentNode = z.infer<typeof agentNodeSchema>;

// -----------------------------------------------------------------------------
// Conditional Node
// -----------------------------------------------------------------------------

export const conditionalBranchSchema = z.object({
  condition: z.string().min(1),
  label: z.string().optional(),
  targetNodeId: z.string().min(1),
});

export type ConditionalBranch = z.infer<typeof conditionalBranchSchema>;

export const conditionalNodeSchema = baseNodeSchema.extend({
  type: z.literal('conditional'),
  expression: z.string().min(1),
  branches: z.array(conditionalBranchSchema).min(1),
  defaultBranch: z.string().optional(),
});

export type ConditionalNode = z.infer<typeof conditionalNodeSchema>;

// -----------------------------------------------------------------------------
// Loop Node
// -----------------------------------------------------------------------------

export const loopNodeSchema = baseNodeSchema.extend({
  type: z.literal('loop'),
  iteratorVariable: z.string().min(1),
  collection: z.string().min(1),
  maxIterations: z.number().positive().optional(),
  breakCondition: z.string().optional(),
  bodyNodeIds: z.array(z.string()),
});

export type LoopNode = z.infer<typeof loopNodeSchema>;

// -----------------------------------------------------------------------------
// Parallel Node
// -----------------------------------------------------------------------------

export const parallelNodeSchema = baseNodeSchema.extend({
  type: z.literal('parallel'),
  branchNodeIds: z.array(z.string()).min(1),
  waitForAll: z.boolean().default(true),
  maxConcurrency: z.number().positive().optional(),
});

export type ParallelNode = z.infer<typeof parallelNodeSchema>;

// -----------------------------------------------------------------------------
// Start Node
// -----------------------------------------------------------------------------

export const startNodeSchema = baseNodeSchema.extend({
  type: z.literal('start'),
  inputs: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        required: z.boolean().default(true),
        defaultValue: z.unknown().optional(),
      })
    )
    .optional(),
});

export type StartNode = z.infer<typeof startNodeSchema>;

// -----------------------------------------------------------------------------
// End Node
// -----------------------------------------------------------------------------

export const endNodeSchema = baseNodeSchema.extend({
  type: z.literal('end'),
  outputs: z
    .array(
      z.object({
        name: z.string().min(1),
        type: z.string().min(1),
        sourceNodeId: z.string().optional(),
        sourceOutput: z.string().optional(),
      })
    )
    .optional(),
});

export type EndNode = z.infer<typeof endNodeSchema>;

// -----------------------------------------------------------------------------
// Workflow Node Union
// -----------------------------------------------------------------------------

export const workflowNodeSchema = z.discriminatedUnion('type', [
  skillNodeSchema,
  commandNodeSchema,
  agentNodeSchema,
  conditionalNodeSchema,
  loopNodeSchema,
  parallelNodeSchema,
  startNodeSchema,
  endNodeSchema,
]);

export type WorkflowNode = z.infer<typeof workflowNodeSchema>;

// =============================================================================
// EDGE TYPES
// =============================================================================

export const edgeTypeSchema = z.enum(['sequential', 'handoff', 'dataflow', 'conditional']);

export type EdgeType = z.infer<typeof edgeTypeSchema>;

// -----------------------------------------------------------------------------
// Base Edge Schema
// -----------------------------------------------------------------------------

export const baseEdgeSchema = z.object({
  id: z.string().min(1),
  type: edgeTypeSchema,
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  label: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type BaseEdge = z.infer<typeof baseEdgeSchema>;

// -----------------------------------------------------------------------------
// Sequential Edge
// -----------------------------------------------------------------------------

export const sequentialEdgeSchema = baseEdgeSchema.extend({
  type: z.literal('sequential'),
});

export type SequentialEdge = z.infer<typeof sequentialEdgeSchema>;

// -----------------------------------------------------------------------------
// Handoff Edge
// -----------------------------------------------------------------------------

export const handoffEdgeSchema = baseEdgeSchema.extend({
  type: z.literal('handoff'),
  context: z.record(z.string(), z.unknown()).optional(),
  preserveHistory: z.boolean().default(true),
});

export type HandoffEdge = z.infer<typeof handoffEdgeSchema>;

// -----------------------------------------------------------------------------
// Dataflow Edge
// -----------------------------------------------------------------------------

export const dataflowEdgeSchema = baseEdgeSchema.extend({
  type: z.literal('dataflow'),
  sourceOutput: z.string().min(1),
  targetInput: z.string().min(1),
  transform: z.string().optional(),
});

export type DataflowEdge = z.infer<typeof dataflowEdgeSchema>;

// -----------------------------------------------------------------------------
// Conditional Edge
// -----------------------------------------------------------------------------

export const conditionalEdgeSchema = baseEdgeSchema.extend({
  type: z.literal('conditional'),
  condition: z.string().min(1),
  priority: z.number().optional(),
});

export type ConditionalEdge = z.infer<typeof conditionalEdgeSchema>;

// -----------------------------------------------------------------------------
// Workflow Edge Union
// -----------------------------------------------------------------------------

export const workflowEdgeSchema = z.discriminatedUnion('type', [
  sequentialEdgeSchema,
  handoffEdgeSchema,
  dataflowEdgeSchema,
  conditionalEdgeSchema,
]);

export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;

// =============================================================================
// WORKFLOW DOCUMENT
// =============================================================================

export const workflowStatusSchema = z.enum(['draft', 'published', 'archived']);

export type WorkflowStatus = z.infer<typeof workflowStatusSchema>;

export const viewportSchema = z.object({
  x: z.number(),
  y: z.number(),
  zoom: z.number().positive(),
});

export type Viewport = z.infer<typeof viewportSchema>;

export const workflowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  nodes: z.array(workflowNodeSchema),
  edges: z.array(workflowEdgeSchema),
  sourceTemplateId: z.string().optional(),
  sourceTemplateName: z.string().optional(),
  viewport: viewportSchema.optional(),
  status: workflowStatusSchema.default('draft'),
  tags: z.array(z.string()).optional(),
  thumbnail: z.string().optional(),
  aiGenerated: z.boolean().optional(),
  aiModel: z.string().optional(),
  /** AI confidence score as percentage (0-100) */
  aiConfidence: z.number().min(0).max(100).int().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Workflow = z.infer<typeof workflowSchema>;

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

/**
 * Validates that a workflow has proper structure:
 * - Exactly one start node
 * - At least one end node
 * - All edge references point to valid nodes
 */
export const validateWorkflowStructure = (
  workflow: Workflow
): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  // Check for start node
  const startNodes = workflow.nodes.filter((n) => n.type === 'start');
  if (startNodes.length === 0) {
    errors.push('Workflow must have exactly one start node');
  } else if (startNodes.length > 1) {
    errors.push(`Workflow has ${startNodes.length} start nodes, expected exactly one`);
  }

  // Check for end nodes
  const endNodes = workflow.nodes.filter((n) => n.type === 'end');
  if (endNodes.length === 0) {
    errors.push('Workflow must have at least one end node');
  }

  // Validate edge references
  for (const edge of workflow.edges) {
    if (!nodeIds.has(edge.sourceNodeId)) {
      errors.push(`Edge ${edge.id} references non-existent source node: ${edge.sourceNodeId}`);
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      errors.push(`Edge ${edge.id} references non-existent target node: ${edge.targetNodeId}`);
    }
  }

  // Validate loop body references
  const loopNodes = workflow.nodes.filter((n): n is LoopNode => n.type === 'loop');
  for (const loop of loopNodes) {
    for (const bodyNodeId of loop.bodyNodeIds) {
      if (!nodeIds.has(bodyNodeId)) {
        errors.push(`Loop node ${loop.id} references non-existent body node: ${bodyNodeId}`);
      }
    }
  }

  // Validate parallel branch references
  const parallelNodes = workflow.nodes.filter((n): n is ParallelNode => n.type === 'parallel');
  for (const parallel of parallelNodes) {
    for (const branchNodeId of parallel.branchNodeIds) {
      if (!nodeIds.has(branchNodeId)) {
        errors.push(
          `Parallel node ${parallel.id} references non-existent branch node: ${branchNodeId}`
        );
      }
    }
  }

  // Validate conditional branch references
  const conditionalNodes = workflow.nodes.filter(
    (n): n is ConditionalNode => n.type === 'conditional'
  );
  for (const conditional of conditionalNodes) {
    for (const branch of conditional.branches) {
      if (!nodeIds.has(branch.targetNodeId)) {
        errors.push(
          `Conditional node ${conditional.id} references non-existent target node: ${branch.targetNodeId}`
        );
      }
    }
    if (conditional.defaultBranch && !nodeIds.has(conditional.defaultBranch)) {
      errors.push(
        `Conditional node ${conditional.id} references non-existent default branch: ${conditional.defaultBranch}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
};

// =============================================================================
// FACTORY HELPERS
// =============================================================================

/**
 * Creates a unique node ID using cuid2
 */
export const createNodeId = (prefix: string = 'node'): string => {
  return `${prefix}_${createId()}`;
};

/**
 * Creates a unique edge ID using cuid2
 */
export const createEdgeId = (sourceId: string, targetId: string): string => {
  return `edge_${sourceId}_${targetId}_${createId()}`;
};
