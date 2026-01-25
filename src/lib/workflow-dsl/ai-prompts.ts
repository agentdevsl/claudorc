/**
 * AI Prompts for Workflow DSL Generation
 *
 * These prompts are used to instruct AI models to analyze templates
 * and generate valid workflow DSL JSON structures.
 */

/**
 * System prompt for AI workflow generation
 */
export const WORKFLOW_GENERATION_SYSTEM_PROMPT = `You are a workflow DSL generator that analyzes templates containing skills and agents to produce structured workflow definitions.

## Your Task

Analyze the provided template content and generate a valid workflow DSL JSON that represents the logical flow of operations. PRESERVE ALL DETAILS from the source content - do not simplify or collapse steps.

## Workflow DSL Structure

A workflow consists of:
1. **Nodes** - Individual operations in the workflow
2. **Edges** - Connections between nodes defining flow and data transfer

### Node Types

- **start**: Entry point with optional input definitions
- **end**: Exit point with optional output mappings
- **skill**: Invokes a registered skill with "/" prefix (e.g., /speckit.specify, /commit, /review-pr)
- **context**: Provides context, prompting instructions, or non-skill content
- **agent**: Invokes an AI agent with specific configuration (e.g., "use opus agents", "concurrent agents")
- **conditional**: Branching logic based on conditions (e.g., "if tests pass", "otherwise")
- **loop**: Iterates over a collection or until a condition (e.g., "repeat 2 times", "until all pass")
- **parallel**: Executes multiple branches concurrently (e.g., "concurrent", "in parallel")

### CRITICAL: Type Classification Rules

**Simple rule: If it starts with "/" → it's a SKILL. Otherwise → it's CONTEXT.**

- "/speckit.specify" → SKILL node with skillId="speckit.specify"
- "/commit" → SKILL node with skillId="commit"
- "/review-pr" → SKILL node with skillId="review-pr"
- "Validate the implementation" → CONTEXT node
- "Ensure tests pass" → CONTEXT node

### Edge Types

- **sequential**: Simple flow from one node to the next
- **handoff**: Agent-to-agent transfer with context preservation
- **dataflow**: Passes data from one node's output to another's input
- **conditional**: Flow based on a condition evaluation

## Output Format

Generate a JSON object with this structure:

\`\`\`json
{
  "description": "A brief 1-2 sentence description of what this workflow accomplishes",
  "nodes": [
    {
      "id": "unique_node_id",
      "type": "start|skill|context|agent|conditional|loop|parallel|end",
      "label": "Short Label (2-4 words max)",
      "position": { "x": 0, "y": 0 },
      "description": "Optional description",
      // Type-specific properties...
    }
  ],
  "edges": [
    {
      "id": "unique_edge_id",
      "type": "sequential|handoff|dataflow|conditional",
      "sourceNodeId": "source_node_id",
      "targetNodeId": "target_node_id",
      // Type-specific properties...
    }
  ],
  "aiGenerated": true,
  "aiConfidence": 0.0-1.0
}
\`\`\`

## IMPORTANT: Label Formatting

**Labels must be SHORT (2-4 words max)**:
- Good: "Validate Issue", "Create Spec", "Run Tests", "Commit Changes"
- Bad: "Validate GitHub Issue and Add Labels", "Create Feature Specification Document"

**For skill nodes, use the name without "/" prefix as skillId**:
- For "/speckit.specify": skillId="speckit.specify", skillName="Specify"
- For "/commit": skillId="commit", skillName="Commit"

**For context nodes, use the content field for the full context text**:
- content="Validate the implementation against requirements"

## Guidelines

1. **Always include start and end nodes** - Every workflow must have exactly one start node and at least one end node.

2. **PRESERVE ALL STEPS** - Do NOT simplify or collapse steps. If the source has 12 steps, generate 12+ nodes (plus start/end). Each numbered item or bullet point should become its own node.

3. **Use correct node types**:
   - \`skill\` - For ANY "/name" invocation (items starting with "/")
   - \`context\` - For prompting/context content (items NOT starting with "/")
   - \`agent\` - For AI agent invocations (e.g., "use opus agents", "concurrent agents")
   - \`loop\` - For repetition (e.g., "repeat 2 times", "iterate until")
   - \`parallel\` - For concurrent execution (e.g., "concurrent agents", "in parallel")
   - \`conditional\` - For branching (e.g., "if tests pass", "otherwise fix issues")

4. **Preserve descriptions** - Copy the FULL description from each step into the node's description field. Include details like "use tdd", "resolve issues independently", "validate all tests passing".

5. **Create meaningful connections** - Use appropriate edge types:
   - Use \`sequential\` for simple step-by-step flow
   - Use \`dataflow\` when output from one node feeds into another
   - Use \`handoff\` when one agent delegates to another
   - Use \`conditional\` for branching logic

6. **Position nodes logically** - Place nodes in a grid-like pattern:
   - Start at position (100, 100)
   - Increment y by 140 for sequential flow (vertical layout)
   - Increment x by 250 for parallel branches

7. **Set confidence score** - Rate your confidence (0.0-1.0) based on:
   - Clarity of the template structure
   - Certainty of inferred relationships
   - Completeness of generated workflow

## Example Analysis

For content like:
\`\`\`
1. /speckit.specify - Create feature specification
2. Validate implementation approach
3. /speckit.plan - Generate implementation plan
4. Perform code review using concurrent opus agents, repeat 2 times
5. Create PR with summary
\`\`\`

Generate:
1. start node
2. skill node: skillId="speckit.specify", skillName="Create Spec", description="/speckit.specify - Create feature specification"
3. context node: content="Validate implementation approach", label="Validate Approach"
4. skill node: skillId="speckit.plan", skillName="Generate Plan", description="/speckit.plan - Generate implementation plan"
5. loop node: description="Perform code review using concurrent opus agents", maxIterations=2
6. context node: content="Create PR with summary", label="Create PR"
7. end node

IMPORTANT:
- Each step in the source becomes a separate node. Do not combine or simplify steps.
- If an item starts with "/" → SKILL node
- If an item does NOT start with "/" → CONTEXT node`;

/**
 * User prompt template for analyzing a specific template
 */
export const createWorkflowAnalysisPrompt = (template: {
  name: string;
  description?: string;
  content: string;
  skills?: Array<{ id: string; name: string; description?: string }>;
  commands?: Array<{ name: string; command: string; description?: string }>;
  agents?: Array<{ id: string; name: string; description?: string; systemPrompt?: string }>;
  // Known skill names for cross-referencing (all / prefixed items are skills)
  knownSkillNames?: string[];
  knownCommandNames?: string[];
}): string => {
  let prompt = `## Template to Analyze

**Name:** ${template.name}
${template.description ? `**Description:** ${template.description}` : ''}

### Template Content

\`\`\`
${template.content}
\`\`\`
`;

  if (template.skills && template.skills.length > 0) {
    prompt += `
### Available Skills

${template.skills
  .map(
    (skill) =>
      `- **${skill.name}** (ID: ${skill.id})${skill.description ? `: ${skill.description}` : ''}`
  )
  .join('\n')}
`;
  }

  // Commands are now treated as context - show them for reference but they become context nodes
  if (template.commands && template.commands.length > 0) {
    prompt += `
### Available Context Items

${template.commands
  .map(
    (cmd) =>
      `- **${cmd.name}**: \`${cmd.command}\`${cmd.description ? ` - ${cmd.description}` : ''}`
  )
  .join('\n')}
`;
  }

  if (template.agents && template.agents.length > 0) {
    prompt += `
### Available Agents

${template.agents
  .map(
    (agent) =>
      `- **${agent.name}** (ID: ${agent.id})${agent.description ? `: ${agent.description}` : ''}${
        agent.systemPrompt ? `\n  System prompt: "${agent.systemPrompt.substring(0, 100)}..."` : ''
      }`
  )
  .join('\n')}
`;
  }

  // Add known skill names for cross-referencing
  const allKnownSkills = [
    ...(template.knownSkillNames || []),
    ...(template.knownCommandNames || []),
  ];
  if (allKnownSkills.length > 0) {
    prompt += `
## KNOWN SKILLS (all "/" prefixed items)

All items with "/" prefix are SKILLS:
${allKnownSkills.map((n) => `- /${n}`).join('\n')}
`;
  }

  prompt += `
## Instructions

Analyze the template content above and generate a complete workflow DSL JSON.

CRITICAL RULES:
- Create ONE NODE for EACH numbered step or bullet point in the content
- **If a step starts with "/" or references a /name → use type: "skill"**
- **If a step does NOT start with "/" → use type: "context"**
- Use "agent" type when AI agents are explicitly mentioned
- Use "loop" type for "repeat X times" or iterations
- Use "parallel" type for "concurrent" operations
- PRESERVE the full description text from each step

Steps:
1. Count all numbered items/bullets in the source - you need at least that many nodes
2. For each step, check if it starts with "/" or contains a /name reference
3. "/" items → skill nodes; non-"/" items → context nodes
4. Copy the FULL step description into the node's description field
5. Connect nodes sequentially with edges
6. Add start node at beginning, end node at the end
7. Position nodes vertically (increment y by 140 for each step)

Return ONLY the JSON workflow object, no additional text.`;

  return prompt;
};

/**
 * Prompt for validating and refining an existing workflow
 */
export const createWorkflowValidationPrompt = (workflow: object): string => {
  return `## Workflow to Validate

\`\`\`json
${JSON.stringify(workflow, null, 2)}
\`\`\`

## Instructions

Analyze the workflow above and:

1. **Check structural validity**:
   - Verify exactly one start node exists
   - Verify at least one end node exists
   - Ensure all edge references point to valid nodes
   - Check for unreachable nodes (no incoming edges except start)
   - Check for dead ends (no outgoing edges except end)

2. **Validate node configurations**:
   - Skill nodes have valid skillId and skillName
   - Context nodes have valid content strings
   - Agent nodes have required agentId and agentName
   - Conditional nodes have valid branch definitions
   - Loop and parallel nodes reference existing nodes

3. **Check edge consistency**:
   - Dataflow edges have valid sourceOutput and targetInput
   - Conditional edges have valid condition expressions
   - Handoff edges have appropriate context

4. **Suggest improvements**:
   - Missing connections
   - Redundant nodes or edges
   - Better flow organization
   - Clearer labels or descriptions

Return a JSON object with:
\`\`\`json
{
  "valid": true|false,
  "errors": ["list of structural errors"],
  "warnings": ["list of potential issues"],
  "suggestions": ["list of improvement suggestions"],
  "correctedWorkflow": { /* optional: corrected workflow if errors found */ }
}
\`\`\``;
};

/**
 * Prompt for generating a workflow from natural language description
 */
export const createWorkflowFromDescriptionPrompt = (description: string): string => {
  return `## Workflow Description

${description}

## Instructions

Based on the natural language description above, generate a complete workflow DSL JSON.

1. **Parse the requirements**:
   - Identify the main operations or steps described
   - Determine inputs and outputs
   - Find conditional logic or branching requirements
   - Identify parallel operations
   - Note any loops or iterations

2. **Create appropriate nodes**:
   - Use skill nodes for "/" prefixed operations (e.g., /commit, /review-pr)
   - Use context nodes for prompting/context content
   - Use agent nodes for AI-powered tasks
   - Use conditional nodes for decision points
   - Use parallel nodes for concurrent operations
   - Use loop nodes for iterations

3. **Connect with appropriate edges**:
   - Sequential edges for step-by-step flow
   - Dataflow edges when passing data between nodes
   - Conditional edges for branching logic
   - Handoff edges between agents

4. **Position and label clearly**:
   - Give each node a descriptive label
   - Position nodes in logical reading order (left to right, top to bottom)
   - Add descriptions where helpful

5. **Set confidence appropriately**:
   - Higher confidence for clear, specific descriptions
   - Lower confidence for vague or ambiguous requirements

Return ONLY the JSON workflow object, no additional text.`;
};

/**
 * Prompt for merging or combining multiple workflows
 */
export const createWorkflowMergePrompt = (
  workflows: Array<{ name: string; workflow: object }>,
  mergeStrategy: 'sequential' | 'parallel' | 'conditional'
): string => {
  return `## Workflows to Merge

${workflows.map((w, i) => `### Workflow ${i + 1}: ${w.name}\n\`\`\`json\n${JSON.stringify(w.workflow, null, 2)}\n\`\`\``).join('\n\n')}

## Merge Strategy: ${mergeStrategy}

${
  mergeStrategy === 'sequential'
    ? 'Connect workflows end-to-end, where one workflow completes before the next begins.'
    : mergeStrategy === 'parallel'
      ? 'Run all workflows concurrently, with a single start triggering all and waiting for all to complete.'
      : 'Add a conditional at the start to route to different workflows based on conditions.'
}

## Instructions

1. Create a new merged workflow that combines all input workflows
2. Generate unique IDs for all nodes and edges (prefix with workflow index)
3. Remove redundant start/end nodes and connect appropriately
4. Maintain the internal logic of each original workflow
5. Add necessary connecting nodes and edges for the merge strategy
6. Recalculate positions to create a clean visual layout

Return the merged workflow as a JSON object.`;
};
