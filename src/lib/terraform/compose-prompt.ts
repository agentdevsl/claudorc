import type { TerraformModule } from '../../db/schema/terraform.js';

export interface ModuleMatch {
  moduleId: string;
  name: string;
  provider: string;
  version: string;
  source: string;
  confidence: number;
  matchReason: string;
}

export function buildModuleContextPrompt(modules: TerraformModule[]): string {
  if (modules.length === 0) {
    return 'No modules are available in the registry.';
  }

  const sections = modules.map((mod) => {
    const lines: string[] = [];
    lines.push(`## Module: ${mod.namespace}/${mod.name}/${mod.provider} v${mod.version}`);
    lines.push(`Source: ${mod.source}`);
    if (mod.description) {
      lines.push(`Description: ${mod.description}`);
    }

    // Inputs
    const inputs = (mod.inputs ?? []) as Array<{
      name: string;
      type: string;
      description?: string;
      default?: string;
      required: boolean;
      sensitive?: boolean;
    }>;
    if (inputs.length > 0) {
      lines.push('');
      lines.push('### Inputs:');
      for (const input of inputs) {
        const parts = [`- \`${input.name}\` (${input.type})`];
        if (input.required) parts.push('[REQUIRED]');
        if (input.description) parts.push(`- ${input.description}`);
        if (input.default !== undefined) parts.push(`(default: ${input.default})`);
        if (input.sensitive) parts.push('[SENSITIVE]');
        lines.push(parts.join(' '));
      }
    }

    // Outputs
    const outputs = (mod.outputs ?? []) as Array<{ name: string; description?: string }>;
    if (outputs.length > 0) {
      lines.push('');
      lines.push('### Outputs:');
      for (const output of outputs) {
        lines.push(`- \`${output.name}\`${output.description ? ` - ${output.description}` : ''}`);
      }
    }

    // Dependencies
    const deps = (mod.dependencies ?? []) as string[];
    if (deps.length > 0) {
      lines.push('');
      lines.push(`### Dependencies: ${deps.join(', ')}`);
    }

    return lines.join('\n');
  });

  return sections.join('\n\n---\n\n');
}

export function buildCompositionSystemPrompt(moduleContext: string): string {
  return `You are a Terraform infrastructure composer. You help users design and generate Terraform configurations using private modules from their HCP Terraform registry.

## Your Capabilities:
- Match user infrastructure requirements to available private modules
- Generate complete, valid Terraform HCL configurations
- Ask clarifying questions for required variables that don't have defaults
- Explain module choices and architecture decisions

## Rules:
1. ONLY use modules from the catalog below. Never invent module sources.
2. Use the exact \`source\` path from the catalog for each module block.
3. Use \`module.X.output_name\` syntax for cross-module references.
4. Always include a \`terraform {}\` block with \`required_providers\` when generating code.
5. For required variables without defaults, ask the user before generating code.
6. When generating Terraform code, wrap it in a \`\`\`hcl code fence.
7. Explain your module choices briefly before showing code.
8. If no modules match the user's request, say so clearly and suggest alternatives.

## Response Format:
- Start with a brief explanation of your approach
- List which modules you're using and why
- Then provide the complete HCL code in a single \`\`\`hcl block
- After the code, note any variables the user should customize

## Available Modules:

${moduleContext}`;
}
