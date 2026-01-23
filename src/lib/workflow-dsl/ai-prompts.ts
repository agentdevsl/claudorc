/**
 * AI Prompts for Workflow DSL Generation
 *
 * These prompts are used to instruct AI models to analyze templates
 * and generate valid workflow DSL JSON structures.
 */

/**
 * System prompt for AI workflow generation
 */
export const WORKFLOW_GENERATION_SYSTEM_PROMPT = `You are a workflow DSL generator that analyzes templates containing skills, commands, and agents to produce structured workflow definitions.

## Your Task

Analyze the provided template content and generate a valid workflow DSL JSON that represents the logical flow of operations. PRESERVE ALL DETAILS from the source content - do not simplify or collapse steps.

## Workflow DSL Structure

A workflow consists of:
1. **Nodes** - Individual operations in the workflow
2. **Edges** - Connections between nodes defining flow and data transfer

### Node Types

- **start**: Entry point with optional input definitions
- **end**: Exit point with optional output mappings
- **skill**: Invokes a registered skill (e.g., /speckit.specify, /commit, /review-pr). Use this for ANY step that mentions invoking a skill with "/" prefix.
- **command**: Executes a shell command, git operation, or CLI action (e.g., git commit, npm test, gh pr create)
- **agent**: Invokes an AI agent with specific configuration (e.g., "use opus agents", "concurrent agents")
- **conditional**: Branching logic based on conditions (e.g., "if tests pass", "otherwise")
- **loop**: Iterates over a collection or until a condition (e.g., "repeat 2 times", "until all pass")
- **parallel**: Executes multiple branches concurrently (e.g., "concurrent", "in parallel")

### CRITICAL: Skill Recognition

When the source content mentions invoking skills with "/" prefix like:
- "/speckit.specify" → Create a SKILL node with skillId="speckit.specify", skillName="Specify"
- "/speckit.plan" → Create a SKILL node with skillId="speckit.plan", skillName="Plan"
- "/commit" → Create a SKILL node with skillId="commit", skillName="Commit"

DO NOT collapse skill invocations into command nodes. Each skill invocation should be its own node.

### Edge Types

- **sequential**: Simple flow from one node to the next
- **handoff**: Agent-to-agent transfer with context preservation
- **dataflow**: Passes data from one node's output to another's input
- **conditional**: Flow based on a condition evaluation

## Output Format

Generate a JSON object with this structure:

\`\`\`json
{
  "nodes": [
    {
      "id": "unique_node_id",
      "type": "start|skill|command|agent|conditional|loop|parallel|end",
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

## IMPORTANT: Label and Command Formatting

**Labels must be SHORT (2-4 words max)**:
- Good: "Validate Issue", "Create Spec", "Run Tests", "Commit Changes"
- Bad: "Validate GitHub Issue and Add Labels", "Create Feature Specification Document"

**For skill/command nodes, use the EXACT /name as the command/skillId**:
- For skills: skillId="/speckit.specify" or skillId="speckit.specify"
- For commands: command="/commit" or the actual shell command like "git commit"
- The /name should appear in the node's command or skillId field, NOT in the label

## Guidelines

1. **Always include start and end nodes** - Every workflow must have exactly one start node and at least one end node.

2. **PRESERVE ALL STEPS** - Do NOT simplify or collapse steps. If the source has 12 steps, generate 12+ nodes (plus start/end). Each numbered item or bullet point should become its own node.

3. **Use correct node types**:
   - \`skill\` - For ANY "/skillname" invocation (e.g., /speckit.specify, /commit)
   - \`command\` - For shell commands, git operations, CI/CD checks
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
2. git commit - Commit changes
3. /speckit.plan - Generate implementation plan
4. Perform code review using concurrent opus agents, repeat 2 times
5. Create PR with summary
\`\`\`

If /speckit.specify and /speckit.plan are in the COMMANDS list, generate:
1. start node
2. command node: command="speckit.specify", label="Create Feature Specification", description="/speckit.specify - Create feature specification"
3. command node: command="git commit", label="Commit Changes", description="Commit changes"
4. command node: command="speckit.plan", label="Generate Implementation Plan", description="/speckit.plan - Generate implementation plan"
5. loop node: description="Perform code review using concurrent opus agents", maxIterations=2
6. command node: command="gh pr create", description="Create PR with summary"
7. end node

If /speckit.specify and /speckit.plan are in the SKILLS list, generate skill nodes instead:
2. skill node: skillId="speckit.specify", skillName="Create Feature Specification", description="/speckit.specify - Create feature specification"

IMPORTANT:
- Each step in the source becomes a separate node. Do not combine or simplify steps.
- ALWAYS preserve the original /name in the command or skillId field (without the leading slash).
- The type (skill vs command) is determined by which list the /name appears in above.`;

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
  // Known names from all templates for cross-referencing
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

  if (template.commands && template.commands.length > 0) {
    prompt += `
### Available Commands

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

  // Add known skill/command names for cross-referencing
  if (
    (template.knownSkillNames && template.knownSkillNames.length > 0) ||
    (template.knownCommandNames && template.knownCommandNames.length > 0)
  ) {
    prompt += `
## KNOWN SKILL AND COMMAND NAMES (for type identification)

Use this reference to determine if a "/" reference is a SKILL or COMMAND:

`;
    if (template.knownSkillNames && template.knownSkillNames.length > 0) {
      prompt += `**SKILLS** (use type: "skill" for these):
${template.knownSkillNames.map((n) => `- /${n}`).join('\n')}

`;
    }
    if (template.knownCommandNames && template.knownCommandNames.length > 0) {
      prompt += `**COMMANDS** (use type: "command" for these):
${template.knownCommandNames.map((n) => `- /${n}`).join('\n')}

`;
    }
    prompt += `When the content references any of the above with "/" prefix, use the corresponding node type.
`;
  }

  prompt += `
## Instructions

Analyze the template content above and generate a complete workflow DSL JSON.

CRITICAL RULES:
- Create ONE NODE for EACH numbered step or bullet point in the content
- If a step references a known SKILL (from the list above), use type: "skill" with skillId and skillName
- If a step references a known COMMAND (from the list above), use type: "command"
- For git/shell operations not in the lists, use type: "command"
- Use "agent" type when AI agents are mentioned
- Use "loop" type for "repeat X times" or iterations
- Use "parallel" type for "concurrent" operations
- PRESERVE the full description text from each step
- IMPORTANT: When a step references a /name (like /speckit.specify), PRESERVE the exact /name in the skillId or command field. Do NOT convert it to a human-readable label only - keep the original reference.

Steps:
1. Count all numbered items/bullets in the source - you need at least that many nodes
2. For each step, check if it references a known skill or command from the lists above
3. Create the appropriate node type based on the reference
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
   - Command nodes have valid command strings
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
   - Use skill nodes for high-level operations (review, commit, deploy, etc.)
   - Use command nodes for specific shell commands
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
