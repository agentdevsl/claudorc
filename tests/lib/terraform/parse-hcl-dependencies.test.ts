import { describe, expect, it } from 'vitest';
import { parseHclDependencies } from '../../../src/lib/terraform/parse-hcl-dependencies';
import type { ModuleMatch } from '../../../src/lib/terraform/types';

function makeModuleMatch(overrides: Partial<ModuleMatch> = {}): ModuleMatch {
  return {
    moduleId: 'mod-1',
    name: 'test-module',
    provider: 'aws',
    version: '1.0.0',
    source: 'terraform-aws-modules/vpc/aws',
    confidence: 0.95,
    matchReason: 'exact',
    ...overrides,
  };
}

describe('parseHclDependencies', () => {
  it('returns empty graph for empty code', () => {
    const result = parseHclDependencies('', []);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('returns empty graph for code with no module blocks', () => {
    const code = `
      resource "aws_instance" "web" {
        ami = "abc-123"
      }
    `;
    const result = parseHclDependencies(code, []);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('parses a single module block correctly', () => {
    const code = `
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  name = "my-vpc"
  cidr = "10.0.0.0/16"
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: 'vpc',
      label: 'Vpc',
      source: 'terraform-aws-modules/vpc/aws',
      provider: 'aws',
    });
    expect(result.edges).toHaveLength(0);
  });

  it('parses multiple modules with nested braces', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  tags = {
    Name = "my-vpc"
    Env  = "prod"
  }
}

module "eks" {
  source = "terraform-aws-modules/eks/aws"

  cluster_config = {
    node_groups = {
      default = {
        instance_type = "t3.medium"
      }
    }
  }
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.id)).toEqual(['vpc', 'eks']);
    // Verify nested braces did not break parsing
    expect(result.nodes[1]?.source).toBe('terraform-aws-modules/eks/aws');
  });

  it('extracts explicit depends_on edges', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

module "eks" {
  source     = "terraform-aws-modules/eks/aws"
  depends_on = [module.vpc]
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'vpc->eks',
      source: 'vpc',
      target: 'eks',
      type: 'explicit',
    });
  });

  it('extracts multiple explicit depends_on targets', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

module "rds" {
  source = "terraform-aws-modules/rds/aws"
}

module "app" {
  source     = "terraform-aws-modules/ecs/aws"
  depends_on = [module.vpc, module.rds]
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.edges).toHaveLength(2);
    expect(result.edges.map((e) => e.source).sort()).toEqual(['rds', 'vpc']);
    expect(result.edges.every((e) => e.target === 'app')).toBe(true);
    expect(result.edges.every((e) => e.type === 'explicit')).toBe(true);
  });

  it('extracts implicit module.X.output references', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

module "eks" {
  source     = "terraform-aws-modules/eks/aws"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'vpc->eks',
      source: 'vpc',
      target: 'eks',
      type: 'implicit',
    });
    // Label should contain the referenced outputs
    expect(result.edges[0]?.label).toContain('vpc_id');
    expect(result.edges[0]?.label).toContain('private_subnets');
  });

  it('excludes self-references', () => {
    const code = `
module "app" {
  source = "terraform-aws-modules/ecs/aws"
  name   = module.app.cluster_name
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('deduplicates edges when both explicit and implicit point to same target', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

module "eks" {
  source     = "terraform-aws-modules/eks/aws"
  vpc_id     = module.vpc.vpc_id
  depends_on = [module.vpc]
}
`;
    const result = parseHclDependencies(code, []);
    // Only one edge from vpc->eks (explicit wins since it's processed first)
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.id).toBe('vpc->eks');
  });

  it('matches module by source from matchedModules', () => {
    const code = `
module "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}
`;
    const matched = [
      makeModuleMatch({
        source: 'terraform-aws-modules/vpc/aws',
        confidence: 0.99,
        provider: 'AWS',
      }),
    ];
    const result = parseHclDependencies(code, matched);
    expect(result.nodes[0]?.confidence).toBe(0.99);
    expect(result.nodes[0]?.provider).toBe('aws');
  });

  it('matches module by name when source does not match', () => {
    const code = `
module "vpc" {
  source = "some-custom-registry/vpc/custom"
}
`;
    const matched = [
      makeModuleMatch({
        name: 'vpc',
        source: 'different-source',
        confidence: 0.8,
        provider: 'AWS',
      }),
    ];
    const result = parseHclDependencies(code, matched);
    expect(result.nodes[0]?.confidence).toBe(0.8);
  });

  describe('provider inference from source string', () => {
    it('infers aws from source containing "aws"', () => {
      const code = `module "x" { source = "terraform-aws-modules/vpc/aws" }`;
      const result = parseHclDependencies(code, []);
      expect(result.nodes[0]?.provider).toBe('aws');
    });

    it('infers azure from source containing "azure"', () => {
      const code = `module "x" { source = "Azure/network/azurerm" }`;
      const result = parseHclDependencies(code, []);
      expect(result.nodes[0]?.provider).toBe('azure');
    });

    it('infers gcp from source containing "google"', () => {
      const code = `module "x" { source = "terraform-google-modules/network/google" }`;
      const result = parseHclDependencies(code, []);
      expect(result.nodes[0]?.provider).toBe('gcp');
    });

    it('returns unknown for unrecognized source', () => {
      const code = `module "x" { source = "custom/module/foo" }`;
      const result = parseHclDependencies(code, []);
      expect(result.nodes[0]?.provider).toBe('unknown');
    });

    it('prefers provider from matchedModule over source inference', () => {
      const code = `module "x" { source = "custom/module/foo" }`;
      const matched = [makeModuleMatch({ source: 'custom/module/foo', provider: 'Google Cloud' })];
      const result = parseHclDependencies(code, matched);
      expect(result.nodes[0]?.provider).toBe('gcp');
    });
  });

  it('ignores depends_on references to non-existent modules', () => {
    const code = `
module "vpc" {
  source     = "terraform-aws-modules/vpc/aws"
  depends_on = [module.nonexistent]
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('ignores implicit references to non-existent modules', () => {
    const code = `
module "eks" {
  source = "terraform-aws-modules/eks/aws"
  vpc_id = module.nonexistent.vpc_id
}
`;
    const result = parseHclDependencies(code, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });
});
