import type { ParsedHclVariable } from './parse-hcl-variables';

/**
 * Generates terraform.tfvars content from variable definitions and user-supplied values.
 * Only includes variables that have a user-supplied value.
 */
export function generateTfvars(
  variables: ParsedHclVariable[],
  values: Record<string, string>
): string {
  const lines: string[] = [];

  for (const v of variables) {
    const value = values[v.name];
    if (value === undefined || value === '') continue;

    if (v.description) {
      lines.push(`# ${v.description}`);
    }

    lines.push(`${v.name} = ${formatValue(value, v.normalizedType)}`);
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

function formatValue(value: string, type: string): string {
  switch (type) {
    case 'number':
      return value;
    case 'bool':
      return value;
    case 'list':
    case 'map':
    case 'object':
      return value;
    default:
      // String type — quote it unless it's already quoted
      if (value.startsWith('"') && value.endsWith('"')) return value;
      return `"${value}"`;
  }
}
