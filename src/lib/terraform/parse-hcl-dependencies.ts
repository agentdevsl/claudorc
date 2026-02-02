import type { ModuleMatch } from './types';

export interface TerraformGraphNode {
  id: string;
  label: string;
  provider: string;
  source: string;
  confidence: number;
}

export interface TerraformGraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'explicit' | 'implicit';
  label?: string;
}

export interface TerraformGraph {
  nodes: TerraformGraphNode[];
  edges: TerraformGraphEdge[];
}

interface ParsedModule {
  name: string;
  source: string;
  body: string;
}

/**
 * Extracts module blocks from HCL code using brace-counting to handle nested braces.
 */
function extractModuleBlocks(code: string): ParsedModule[] {
  const modules: ParsedModule[] = [];
  const modulePattern = /module\s+"([^"]+)"\s*\{/g;
  let match: RegExpExecArray | null;

  for (match = modulePattern.exec(code); match !== null; match = modulePattern.exec(code)) {
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
    modules.push({
      name,
      source: sourceMatch?.[1] ?? '',
      body,
    });
  }

  return modules;
}

/**
 * Extracts explicit depends_on references from a module body.
 * Matches `depends_on = [module.x, module.y]`
 */
function extractExplicitDeps(body: string): string[] {
  const deps: string[] = [];
  const dependsOnMatch = body.match(/depends_on\s*=\s*\[([^\]]*)\]/);
  if (!dependsOnMatch) return deps;

  const refs = dependsOnMatch[1]?.match(/module\.(\w+)/g);
  if (refs) {
    for (const ref of refs) {
      const name = ref.replace('module.', '');
      deps.push(name);
    }
  }
  return deps;
}

/**
 * Extracts implicit module references (module.X.output_name) from a module body.
 * Returns map of referenced module name → set of output names.
 */
function extractImplicitRefs(body: string, ownName: string): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  const refPattern = /module\.(\w+)\.(\w+)/g;
  let match: RegExpExecArray | null;

  for (match = refPattern.exec(body); match !== null; match = refPattern.exec(body)) {
    const moduleName = match[1] ?? '';
    const outputName = match[2] ?? '';
    if (moduleName === ownName) continue;
    if (!refs.has(moduleName)) refs.set(moduleName, new Set());
    refs.get(moduleName)?.add(outputName);
  }

  return refs;
}

/**
 * Infers provider from module source string.
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
 * Parses HCL code to extract module dependency graph.
 */
export function parseHclDependencies(code: string, matchedModules: ModuleMatch[]): TerraformGraph {
  const parsed = extractModuleBlocks(code);
  if (parsed.length === 0) return { nodes: [], edges: [] };

  const moduleNames = new Set(parsed.map((m) => m.name));

  // Build a source → ModuleMatch lookup
  const matchBySource = new Map<string, ModuleMatch>();
  const matchByName = new Map<string, ModuleMatch>();
  for (const mm of matchedModules) {
    matchBySource.set(mm.source, mm);
    // Also match by module name (lowercase, strip common prefixes)
    const simpleName = mm.name
      .toLowerCase()
      .replace(/^terraform-/, '')
      .replace(/^(aws|azure|gcp)-/, '');
    matchByName.set(simpleName, mm);
  }

  const nodes: TerraformGraphNode[] = parsed.map((m) => {
    const matched = matchBySource.get(m.source) ?? matchByName.get(m.name.toLowerCase());
    return {
      id: m.name,
      label: m.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      provider: inferProvider(m.source, matched),
      source: m.source,
      confidence: matched?.confidence ?? 0,
    };
  });

  const edges: TerraformGraphEdge[] = [];
  const edgeIds = new Set<string>();

  for (const m of parsed) {
    // Explicit depends_on
    const explicitDeps = extractExplicitDeps(m.body);
    for (const dep of explicitDeps) {
      if (moduleNames.has(dep)) {
        const edgeId = `${dep}->${m.name}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({ id: edgeId, source: dep, target: m.name, type: 'explicit' });
        }
      }
    }

    // Implicit module.X.output references
    const implicitRefs = extractImplicitRefs(m.body, m.name);
    for (const [refModule, outputs] of implicitRefs) {
      if (moduleNames.has(refModule)) {
        const edgeId = `${refModule}->${m.name}`;
        if (!edgeIds.has(edgeId)) {
          edgeIds.add(edgeId);
          edges.push({
            id: edgeId,
            source: refModule,
            target: m.name,
            type: 'implicit',
            label: [...outputs].join(', '),
          });
        }
      }
    }
  }

  return { nodes, edges };
}
