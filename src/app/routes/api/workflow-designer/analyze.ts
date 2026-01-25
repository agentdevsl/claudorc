import Anthropic from '@anthropic-ai/sdk';
import { createId } from '@paralleldrive/cuid2';
import { createFileRoute } from '@tanstack/react-router';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { z } from 'zod';
import { getApiServicesOrThrow } from '@/app/routes/api/runtime';
import { sqlite } from '@/db/client';
import * as schema from '@/db/schema/index.js';
import type { CachedAgent, CachedCommand, CachedSkill } from '@/db/schema/templates';
import { withErrorHandling } from '@/lib/api/middleware';
import { failure, success } from '@/lib/api/response';
import { parseBody } from '@/lib/api/validation';
import { DEFAULT_WORKFLOW_MODEL, getFullModelId } from '@/lib/constants/models';
import { createError } from '@/lib/errors/base';
import {
  createWorkflowAnalysisPrompt,
  WORKFLOW_GENERATION_SYSTEM_PROMPT,
} from '@/lib/workflow-dsl/ai-prompts';
import type { Workflow, WorkflowEdge, WorkflowNode } from '@/lib/workflow-dsl/types';
import { workflowEdgeSchema, workflowNodeSchema } from '@/lib/workflow-dsl/types';
import { ApiKeyService } from '@/services/api-key.service';

// =============================================================================
// Constants
// =============================================================================

/** Default workflow AI model - can be overridden per request */
const getWorkflowModel = (requestModel?: string): string => {
  if (requestModel) {
    return getFullModelId(requestModel);
  }
  // Fall back to env var or default
  return process.env.WORKFLOW_AI_MODEL ?? getFullModelId(DEFAULT_WORKFLOW_MODEL);
};

// =============================================================================
// Workflow Errors
// =============================================================================

const WorkflowErrors = {
  TEMPLATE_NOT_FOUND: createError('WORKFLOW_TEMPLATE_NOT_FOUND', 'Template not found', 404),
  NO_CONTENT: createError(
    'WORKFLOW_NO_CONTENT',
    'No template content provided. Provide either templateId or skills/commands/agents data.',
    400
  ),
  API_KEY_NOT_FOUND: createError(
    'WORKFLOW_API_KEY_NOT_FOUND',
    'Anthropic API key not configured. Please add your API key in settings.',
    401
  ),
  AI_GENERATION_FAILED: (reason: string) =>
    createError('WORKFLOW_AI_GENERATION_FAILED', `AI workflow generation failed: ${reason}`, 500, {
      reason,
    }),
  INVALID_AI_RESPONSE: (reason: string) =>
    createError('WORKFLOW_INVALID_AI_RESPONSE', `AI returned invalid workflow: ${reason}`, 422, {
      reason,
    }),
  LAYOUT_FAILED: (reason: string) =>
    createError('WORKFLOW_LAYOUT_FAILED', `Failed to layout workflow: ${reason}`, 500, { reason }),
} as const;

// =============================================================================
// Request Schema
// =============================================================================

const cachedSkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
});

const cachedCommandSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
});

const cachedAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  content: z.string(),
});

const analyzeWorkflowSchema = z
  .object({
    templateId: z.string().optional(),
    skills: z.array(cachedSkillSchema).optional(),
    commands: z.array(cachedCommandSchema).optional(),
    agents: z.array(cachedAgentSchema).optional(),
    name: z.string().optional(),
    // Known skill/command names for cross-referencing during analysis
    knownSkills: z.array(z.string()).optional(),
    knownCommands: z.array(z.string()).optional(),
    knownAgents: z.array(z.string()).optional(),
    // Model override (short ID like 'claude-sonnet-4' or full ID)
    model: z.string().optional(),
  })
  .refine(
    (data) =>
      data.templateId ||
      (data.skills && data.skills.length > 0) ||
      (data.commands && data.commands.length > 0) ||
      (data.agents && data.agents.length > 0),
    {
      message: 'Either templateId or at least one of skills, commands, or agents must be provided',
    }
  );

// =============================================================================
// AI Response Schema
// =============================================================================

const aiWorkflowResponseSchema = z.object({
  nodes: z.array(z.unknown()),
  edges: z.array(z.unknown()),
  aiGenerated: z.boolean().optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
});

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Builds the template content string from skills, commands, and agents
 */
function buildTemplateContent(
  skills: CachedSkill[],
  commands: CachedCommand[],
  agents: CachedAgent[]
): string {
  const sections: string[] = [];

  if (skills.length > 0) {
    sections.push('## Skills\n');
    for (const skill of skills) {
      sections.push(`### ${skill.name}`);
      if (skill.description) {
        sections.push(skill.description);
      }
      sections.push(`\`\`\`\n${skill.content}\n\`\`\`\n`);
    }
  }

  if (commands.length > 0) {
    sections.push('## Commands\n');
    for (const command of commands) {
      sections.push(`### ${command.name}`);
      if (command.description) {
        sections.push(command.description);
      }
      sections.push(`\`\`\`\n${command.content}\n\`\`\`\n`);
    }
  }

  if (agents.length > 0) {
    sections.push('## Agents\n');
    for (const agent of agents) {
      sections.push(`### ${agent.name}`);
      if (agent.description) {
        sections.push(agent.description);
      }
      sections.push(`\`\`\`\n${agent.content}\n\`\`\`\n`);
    }
  }

  return sections.join('\n');
}

/**
 * Parses and validates the AI response into workflow nodes and edges
 */
function parseAIResponse(responseText: string): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  aiConfidence: number;
} {
  // Extract JSON from the response (handle markdown code blocks)
  let jsonStr = responseText.trim();
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch?.[1]) {
    jsonStr = jsonMatch[1].trim();
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Invalid JSON in AI response: ${e instanceof Error ? e.message : String(e)}`);
  }

  // Validate basic structure
  const validated = aiWorkflowResponseSchema.safeParse(parsed);
  if (!validated.success) {
    throw new Error(`Invalid workflow structure: ${validated.error.message}`);
  }

  // Parse and validate individual nodes
  const nodes: WorkflowNode[] = [];
  for (const nodeData of validated.data.nodes) {
    const nodeResult = workflowNodeSchema.safeParse(nodeData);
    if (nodeResult.success) {
      nodes.push(nodeResult.data);
    } else {
      // Log warning but continue - AI might generate slightly malformed nodes
      console.warn('[workflow-analyze] Skipping invalid node:', nodeResult.error.message, nodeData);
    }
  }

  // Parse and validate individual edges
  const edges: WorkflowEdge[] = [];
  for (const edgeData of validated.data.edges) {
    const edgeResult = workflowEdgeSchema.safeParse(edgeData);
    if (edgeResult.success) {
      edges.push(edgeResult.data);
    } else {
      // Log warning but continue
      console.warn('[workflow-analyze] Skipping invalid edge:', edgeResult.error.message, edgeData);
    }
  }

  // Ensure we have at least start and end nodes
  if (nodes.length === 0) {
    throw new Error('AI generated no valid nodes');
  }

  const hasStart = nodes.some((n) => n.type === 'start');
  const hasEnd = nodes.some((n) => n.type === 'end');

  if (!hasStart || !hasEnd) {
    throw new Error('AI response missing required start or end nodes');
  }

  return {
    nodes,
    edges,
    aiConfidence: validated.data.aiConfidence ?? 0.5,
  };
}

/**
 * Post-process nodes to correct types based on known skills.
 * Simple rule: "/" prefixed items → skill nodes, everything else → context nodes.
 * This ensures deterministic type identification rather than relying on AI interpretation.
 */
function correctNodeTypes(
  nodes: WorkflowNode[],
  knownSkills: string[],
  knownCommands: string[]
): WorkflowNode[] {
  // Normalize names for comparison (lowercase, remove separators)
  const normalizeForLookup = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/^\//, '') // Remove leading slash
      .replace(/[_\-.]/g, '') // Remove separators
      .trim();
  };

  // Combine all known names into a single skill set (commands are now just context)
  const allKnownSkills = new Set<string>();
  for (const skill of knownSkills) {
    allKnownSkills.add(normalizeForLookup(skill));
  }
  for (const cmd of knownCommands) {
    allKnownSkills.add(normalizeForLookup(cmd));
  }

  // Pattern includes : for namespaced skills like /commit-commands:commit
  const SKILL_REF_PATTERN = /\/[\w.\-_:]+/g;

  // Extract /name references from text
  const extractSlashReferences = (text: string): string[] => {
    const matches = text.match(SKILL_REF_PATTERN) || [];
    return matches.map((m) => m.replace(/^\//, ''));
  };

  // Check if text contains a slash reference
  const hasSlashReference = (text: string): boolean => {
    return SKILL_REF_PATTERN.test(text);
  };

  return nodes.map((node) => {
    // Skip start/end/agent/loop/parallel/conditional nodes
    if (['start', 'end', 'agent', 'loop', 'parallel', 'conditional'].includes(node.type)) {
      return node;
    }

    // Collect ALL text fields to search
    const textsToSearch: string[] = [node.label];
    if (node.description) textsToSearch.push(node.description);

    // Check skill-related fields
    if ('skillName' in node && node.skillName) {
      textsToSearch.push(node.skillName as string);
    }
    if ('skillId' in node && node.skillId) {
      textsToSearch.push(node.skillId as string);
    }

    // Check content field (for context nodes)
    if ('content' in node && node.content) {
      textsToSearch.push(node.content as string);
    }

    // Check command field (legacy)
    if ('command' in node && node.command) {
      textsToSearch.push(node.command as string);
    }

    // Extract any /name references from all text fields
    const slashRefs: string[] = [];
    for (const text of textsToSearch) {
      if (text) {
        slashRefs.push(...extractSlashReferences(text));
      }
    }

    // Check if any text has a slash reference or matches a known skill
    const hasSlash = textsToSearch.some((t) => t && hasSlashReference(t));
    const matchedSkill = slashRefs.find((ref) => {
      const normalized = normalizeForLookup(ref);
      // Check exact match or prefix match
      if (allKnownSkills.has(normalized)) return true;
      for (const known of allKnownSkills) {
        if (normalized.startsWith(known) || known.startsWith(normalized)) return true;
      }
      return false;
    });

    // If has "/" reference or matches known skill → skill node
    if (hasSlash || matchedSkill) {
      const skillId = matchedSkill || slashRefs[0] || node.label;
      if (node.type !== 'skill') {
        console.log(
          `[workflow-analyze] Correcting node "${node.label}" from ${node.type} to skill (matched: ${skillId})`
        );
        return {
          ...node,
          type: 'skill',
          skillId: skillId,
          skillName: node.label,
        } as WorkflowNode;
      }
      return node;
    }

    // Otherwise → context node
    if (node.type !== 'context') {
      console.log(
        `[workflow-analyze] Correcting node "${node.label}" from ${node.type} to context`,
        {
          textsSearched: textsToSearch.filter(Boolean).slice(0, 3),
          slashRefsFound: slashRefs,
          reason:
            slashRefs.length === 0
              ? 'No slash references found in node text'
              : `Slash refs [${slashRefs.join(', ')}] did not match any known skills`,
        }
      );
      return {
        ...node,
        type: 'context',
        content: node.description || node.label,
      } as WorkflowNode;
    }

    return node;
  });
}

/**
 * Creates the Anthropic client with the stored API key
 */
async function createAnthropicClient(): Promise<Anthropic | null> {
  // Try to get API key from database
  if (!sqlite) {
    return null;
  }

  const db = drizzle(sqlite, { schema });
  const apiKeyService = new ApiKeyService(db);
  const apiKey = await apiKeyService.getDecryptedKey('anthropic');

  if (!apiKey) {
    return null;
  }

  return new Anthropic({ apiKey });
}

// =============================================================================
// Route Handler
// =============================================================================

export const Route = createFileRoute('/api/workflow-designer/analyze')({
  server: {
    handlers: {
      POST: withErrorHandling(async ({ request }) => {
        // Parse and validate request body
        const parsed = await parseBody(request, analyzeWorkflowSchema);
        if (!parsed.ok) {
          return Response.json(failure(parsed.error), { status: 400 });
        }

        const { templateId, skills, commands, agents, name, knownSkills, knownCommands, model } =
          parsed.value;

        // Resolve the model to use
        const workflowModel = getWorkflowModel(model);

        // Gather template data - use passed items if provided, otherwise empty
        let templateSkills: CachedSkill[] = skills ?? [];
        let templateCommands: CachedCommand[] = commands ?? [];
        let templateAgents: CachedAgent[] = agents ?? [];
        let templateName = name ?? 'Generated Workflow';
        let templateDescription: string | undefined;

        // If templateId provided, fetch template for name/description only
        // Selected items (skills/commands/agents) take precedence over template's full list
        if (templateId) {
          const { templateService } = getApiServicesOrThrow();
          const templateResult = await templateService.getById(templateId);

          if (!templateResult.ok) {
            return Response.json(failure(WorkflowErrors.TEMPLATE_NOT_FOUND), { status: 404 });
          }

          const template = templateResult.value;
          templateName = name ?? template.name;
          templateDescription = template.description ?? undefined;

          // Only use template's items if none were explicitly provided
          // This allows the frontend to send only selected items
          if (
            templateSkills.length === 0 &&
            templateCommands.length === 0 &&
            templateAgents.length === 0
          ) {
            templateSkills = template.cachedSkills ?? [];
            templateCommands = template.cachedCommands ?? [];
            templateAgents = template.cachedAgents ?? [];
          }
        }

        // Ensure we have content to analyze
        if (
          templateSkills.length === 0 &&
          templateCommands.length === 0 &&
          templateAgents.length === 0
        ) {
          return Response.json(failure(WorkflowErrors.NO_CONTENT), { status: 400 });
        }

        // Create Anthropic client
        const anthropic = await createAnthropicClient();
        if (!anthropic) {
          return Response.json(failure(WorkflowErrors.API_KEY_NOT_FOUND), { status: 401 });
        }

        // Build template content and prompt
        const templateContent = buildTemplateContent(
          templateSkills,
          templateCommands,
          templateAgents
        );

        const userPrompt = createWorkflowAnalysisPrompt({
          name: templateName,
          description: templateDescription,
          content: templateContent,
          skills: templateSkills.map((s) => ({
            id: s.id,
            name: s.name,
            description: s.description,
          })),
          commands: templateCommands.map((c) => ({
            name: c.name,
            command: c.content,
            description: c.description,
          })),
          agents: templateAgents.map((a) => ({
            id: a.name, // Use name as id since CachedAgent doesn't have id
            name: a.name,
            description: a.description,
            systemPrompt: a.content,
          })),
          // Pass known names for cross-referencing
          knownSkillNames: knownSkills,
          knownCommandNames: knownCommands,
        });

        // Call Anthropic API
        let aiResponse: string;
        try {
          const message = await anthropic.messages.create({
            model: workflowModel,
            max_tokens: 8192,
            system: WORKFLOW_GENERATION_SYSTEM_PROMPT,
            messages: [{ role: 'user', content: userPrompt }],
          });

          // Extract text content from response
          const textBlocks = message.content.filter(
            (block): block is Anthropic.TextBlock => block.type === 'text'
          );
          aiResponse = textBlocks.map((b) => b.text).join('');

          if (!aiResponse) {
            return Response.json(
              failure(WorkflowErrors.AI_GENERATION_FAILED('Empty response from AI')),
              { status: 500 }
            );
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[workflow-analyze] Anthropic API error:', message);
          return Response.json(failure(WorkflowErrors.AI_GENERATION_FAILED(message)), {
            status: 500,
          });
        }

        // Parse AI response into workflow structure
        let nodes: WorkflowNode[];
        let edges: WorkflowEdge[];
        let aiConfidence: number;

        try {
          const result = parseAIResponse(aiResponse);
          nodes = result.nodes;
          edges = result.edges;
          aiConfidence = result.aiConfidence;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error('[workflow-analyze] AI response parsing error:', message);
          return Response.json(failure(WorkflowErrors.INVALID_AI_RESPONSE(message)), {
            status: 422,
          });
        }

        // Post-process nodes to correct types based on known skill/command lists
        // This ensures deterministic type identification
        if (knownSkills?.length || knownCommands?.length) {
          console.log('[workflow-analyze] Known skills:', knownSkills);
          console.log('[workflow-analyze] Known commands:', knownCommands);
          console.log(
            '[workflow-analyze] Nodes before correction:',
            nodes.map((n) => ({ label: n.label, type: n.type }))
          );
          nodes = correctNodeTypes(nodes, knownSkills ?? [], knownCommands ?? []);
          console.log(
            '[workflow-analyze] Nodes after correction:',
            nodes.map((n) => ({ label: n.label, type: n.type }))
          );
        }

        // Note: Layout is handled by the frontend (layoutWorkflowForReactFlow)
        // to ensure consistent node dimensions with the compact node CSS styling.
        // Nodes are returned with position: { x: 0, y: 0 } and the frontend
        // applies ELK layout before rendering.

        // Build final workflow object
        const workflow: Workflow = {
          id: createId(),
          name: templateName,
          description: templateDescription,
          nodes,
          edges,
          sourceTemplateId: templateId,
          sourceTemplateName: templateName,
          status: 'draft',
          aiGenerated: true,
          aiModel: workflowModel,
          aiConfidence,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return Response.json(success({ workflow }), { status: 200 });
      }),
    },
  },
});
