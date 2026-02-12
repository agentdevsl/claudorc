import type {
  TerraformGraph,
  TerraformGraphEdge,
  TerraformGraphNode,
} from './parse-hcl-dependencies';
import type { GeneratedFile, ModuleMatch } from './types';

interface ParsedComponent {
  name: string;
  source: string;
  body: string;
}

/**
 * Extracts component blocks from Terraform Stacks code using brace-counting to handle nested braces.
 */
function extractComponentBlocks(code: string): ParsedComponent[] {
  const components: ParsedComponent[] = [];
  const componentPattern = /component\s+"([^"]+)"\s*\{/g;
  let match: RegExpExecArray | null;

  for (match = componentPattern.exec(code); match !== null; match = componentPattern.exec(code)) {
    const name = match[1] ?? '';
    const startIndex = match.index + match[0].length;
    let depth = 1;
    let i = startIndex;

    while (i < code.length && depth > 0) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') depth--;
      i++;
    }

    const body = code.slice(startIndex, i - 1);
    const sourceMatch = body.match(/source\s*=\s*"([^"]+)"/);
    components.push({
      name,
      source: sourceMatch?.[1] ?? '',
      body,
    });
  }

  return components;
}

/**
 * Extracts implicit component references (component.X.output_name) from a component body.
 * Returns map of referenced component name -> set of output names.
 */
function extractComponentRefs(body: string, ownName: string): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  const refPattern = /component\.(\w+)\.(\w+)/g;
  let match: RegExpExecArray | null;

  for (match = refPattern.exec(body); match !== null; match = refPattern.exec(body)) {
    const componentName = match[1] ?? '';
    const outputName = match[2] ?? '';
    if (componentName === ownName) continue;
    if (!refs.has(componentName)) refs.set(componentName, new Set());
    refs.get(componentName)?.add(outputName);
  }

  return refs;
}

/**
 * Infers provider from component source string.
 */
function inferProvider(source: string, matchedModule?: ModuleMatch): string {
  if (matchedModule?.provider) {
    const p = matchedModule.provider.toLowerCase();
    if (p.includes('aws') || p.includes('amazon')) return 'aws';
    if (p.includes('azure') || p.includes('azurerm')) return 'azure';
    if (p.includes('gcp') || p.includes('google')) return 'gcp';
    return p;
  }
  const s = source.toLowerCase();
  if (s.includes('aws') || s.includes('amazon')) return 'aws';
  if (s.includes('azure') || s.includes('azurerm')) return 'azure';
  if (s.includes('gcp') || s.includes('google')) return 'gcp';
  return 'unknown';
}

/**
 * Parses Terraform Stacks files to extract component dependency graph.
 * Concatenates all file contents and extracts component blocks and their cross-references.
 * Unlike standard Terraform modules, Stacks components do not use depends_on,
 * so all edges are implicit (based on component.X.output references).
 */
export function parseStacksDependencies(
  files: GeneratedFile[],
  matchedModules: ModuleMatch[]
): TerraformGraph {
  const code = files.map((f) => f.code).join('\n');
  const parsed = extractComponentBlocks(code);
  if (parsed.length === 0) return { nodes: [], edges: [] };

  const componentNames = new Set(parsed.map((c) => c.name));

  // Build a source -> ModuleMatch lookup
  const matchBySource = new Map<string, ModuleMatch>();
  const matchByName = new Map<string, ModuleMatch>();
  for (const mm of matchedModules) {
    matchBySource.set(mm.source, mm);
    // Also match by component name (lowercase, strip common prefixes)
    const simpleName = mm.name
      .toLowerCase()
      .replace(/^terraform-/, '')
      .replace(/^(aws|azure|gcp)-/, '');
    matchByName.set(simpleName, mm);
  }

  const nodes: TerraformGraphNode[] = parsed.map((c) => {
    const matched = matchBySource.get(c.source) ?? matchByName.get(c.name.toLowerCase());
    return {
      id: c.name,
      label: c.name.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
      provider: inferProvider(c.source, matched),
      source: c.source,
      confidence: matched?.confidence ?? 0,
    };
  });

  const edges: TerraformGraphEdge[] = [];
  const edgeIds = new Set<string>();

  for (const c of parsed) {
    const implicitRefs = extractComponentRefs(c.body, c.name);
    for (const [refComponent, outputs] of implicitRefs) {
      if (componentNames.has(refComponent)) {
        const edgeId = `${refComponent}->${c.name}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({
            id: edgeId,
            source: refComponent,
            target: c.name,
            type: 'implicit',
            label: [...outputs].join(', '),
          });
        }
      }
    }
  }

  return { nodes, edges };
}
