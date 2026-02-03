/**
 * AI Prompts for Workflow DSL Generation
 *
 * These prompts are used to instruct AI models to analyze templates
 * and generate valid workflow DSL JSON structures.
 *
 * All prompts are configurable via Settings → System Prompts.
 * Default texts are stored in the prompt registry.
 */

import type { SettingsService } from '../../services/settings.service.js';
import { getPromptDefaultText, resolvePromptServer } from '../prompts/index.js';

// ============================================================================
// Defaults (used when no settingsService is available)
// ============================================================================

/** Default system prompt for workflow generation */
export const WORKFLOW_GENERATION_SYSTEM_PROMPT = getPromptDefaultText('workflow-generation-system');

// ============================================================================
// Async resolvers (use settings overrides when available)
// ============================================================================

/**
 * Resolve the workflow generation system prompt, checking for user overrides.
 */
export async function resolveWorkflowGenerationSystemPrompt(
  settingsService: SettingsService
): Promise<string> {
  return resolvePromptServer('workflow-generation-system', settingsService);
}

/**
 * Input shape for workflow analysis prompt builders.
 */
export interface WorkflowAnalysisTemplate {
  name: string;
  description?: string;
  content: string;
  skills?: Array<{ id: string; name: string; description?: string }>;
  commands?: Array<{ name: string; command: string; description?: string }>;
  agents?: Array<{ id: string; name: string; description?: string; systemPrompt?: string }>;
  knownSkillNames?: string[];
  knownCommandNames?: string[];
}

/**
 * Build the variable map for the workflow-analysis prompt template.
 * Pre-renders dynamic sections (skills, agents, known skills) into strings
 * so they can be substituted into the template via {{placeholder}}.
 */
function buildAnalysisVariables(template: WorkflowAnalysisTemplate): Record<string, string> {
  const skillLines = template.skills?.map(
    (skill) =>
      `- **${skill.name}** (ID: ${skill.id})${skill.description ? `: ${skill.description}` : ''}`
  );
  const commandLines = template.commands?.map(
    (cmd) =>
      `- **${cmd.name}** (Command: \`${cmd.command}\`)${cmd.description ? ` - ${cmd.description}` : ''}`
  );

  const allSkillLines = [...(skillLines ?? []), ...(commandLines ?? [])];
  const availableSkills =
    allSkillLines.length > 0 ? `### Available Skills\n\n${allSkillLines.join('\n')}` : '';

  let availableAgents = '';
  if (template.agents && template.agents.length > 0) {
    availableAgents = `### Available Agents\n\n${template.agents
      .map(
        (agent) =>
          `- **${agent.name}** (ID: ${agent.id})${agent.description ? `: ${agent.description}` : ''}${
            agent.systemPrompt
              ? `\n  System prompt: "${agent.systemPrompt.substring(0, 100)}..."`
              : ''
          }`
      )
      .join('\n')}`;
  }

  const allKnownSkills = [
    ...(template.knownSkillNames || []),
    ...(template.knownCommandNames || []),
  ];
  const knownSkills =
    allKnownSkills.length > 0
      ? `## KNOWN SKILLS (all "/" prefixed items)\n\nAll items with "/" prefix are SKILLS:\n${allKnownSkills.map((n) => `- /${n}`).join('\n')}`
      : '';

  return {
    templateName: template.name,
    templateDescription: template.description ? `**Description:** ${template.description}` : '',
    templateData: template.content,
    availableSkills,
    availableAgents,
    knownSkills,
  };
}

/**
 * User prompt template for analyzing a specific template (sync fallback).
 *
 * Uses the registry default text with variable substitution.
 * Prefer `resolveWorkflowAnalysisPrompt` when a settingsService is available.
 */
export const createWorkflowAnalysisPrompt = (template: WorkflowAnalysisTemplate): string => {
  const variables = buildAnalysisVariables(template);
  let text = getPromptDefaultText('workflow-analysis');
  for (const [key, value] of Object.entries(variables)) {
    text = text.replaceAll(`{{${key}}}`, value);
  }
  return text;
};

/**
 * Resolve the workflow analysis prompt, checking for user overrides.
 */
export async function resolveWorkflowAnalysisPrompt(
  template: WorkflowAnalysisTemplate,
  settingsService: SettingsService
): Promise<string> {
  return resolvePromptServer(
    'workflow-analysis',
    settingsService,
    buildAnalysisVariables(template)
  );
}

/**
 * Prompt for validating and refining an existing workflow
 */
export const createWorkflowValidationPrompt = (workflow: object): string => {
  return getPromptDefaultText('workflow-validation').replaceAll(
    '{{workflowJson}}',
    JSON.stringify(workflow, null, 2)
  );
};

/**
 * Resolve the workflow validation prompt, checking for user overrides.
 */
export async function resolveWorkflowValidationPrompt(
  workflow: object,
  settingsService: SettingsService
): Promise<string> {
  return resolvePromptServer('workflow-validation', settingsService, {
    workflowJson: JSON.stringify(workflow, null, 2),
  });
}

/**
 * Prompt for generating a workflow from natural language description
 */
export const createWorkflowFromDescriptionPrompt = (description: string): string => {
  return getPromptDefaultText('workflow-from-description').replaceAll(
    '{{description}}',
    description
  );
};

/**
 * Resolve the workflow-from-description prompt, checking for user overrides.
 */
export async function resolveWorkflowFromDescriptionPrompt(
  description: string,
  settingsService: SettingsService
): Promise<string> {
  return resolvePromptServer('workflow-from-description', settingsService, { description });
}

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
