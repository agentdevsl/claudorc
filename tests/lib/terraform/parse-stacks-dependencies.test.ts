import { describe, expect, it } from 'vitest';
import { parseStacksDependencies } from '../../../src/lib/terraform/parse-stacks-dependencies';
import type { GeneratedFile, ModuleMatch } from '../../../src/lib/terraform/types';

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

function makeFile(filename: string, code: string): GeneratedFile {
  return { filename, code };
}

describe('parseStacksDependencies', () => {
  it('returns empty graph for empty files', () => {
    const result = parseStacksDependencies([], []);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('returns empty graph for files with no component blocks', () => {
    const files = [makeFile('main.tfstack.hcl', 'provider "aws" { region = "us-east-1" }')];
    const result = parseStacksDependencies(files, []);
    expect(result).toEqual({ nodes: [], edges: [] });
  });

  it('parses a single component block correctly', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "vpc" {
  source = "terraform-aws-modules/vpc/aws"
  version = "5.0.0"

  inputs = {
    name = "my-vpc"
    cidr = "10.0.0.0/16"
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]).toMatchObject({
      id: 'vpc',
      label: 'Vpc',
      source: 'terraform-aws-modules/vpc/aws',
      provider: 'aws',
    });
    expect(result.edges).toHaveLength(0);
  });

  it('parses multiple components with nested braces', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "vpc" {
  source = "terraform-aws-modules/vpc/aws"

  inputs = {
    tags = {
      Name = "my-vpc"
      Env  = "prod"
    }
  }
}

component "eks" {
  source = "terraform-aws-modules/eks/aws"

  inputs = {
    cluster_config = {
      node_groups = {
        default = {
          instance_type = "t3.medium"
        }
      }
    }
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.nodes).toHaveLength(2);
    expect(result.nodes.map((n) => n.id)).toEqual(['vpc', 'eks']);
    expect(result.nodes[1]?.source).toBe('terraform-aws-modules/eks/aws');
  });

  it('extracts component.X.output references as implicit edges', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

component "eks" {
  source     = "terraform-aws-modules/eks/aws"

  inputs = {
    vpc_id     = component.vpc.vpc_id
    subnet_ids = component.vpc.private_subnets
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      id: 'vpc->eks',
      source: 'vpc',
      target: 'eks',
      type: 'implicit',
    });
    expect(result.edges[0]?.label).toContain('vpc_id');
    expect(result.edges[0]?.label).toContain('private_subnets');
  });

  it('excludes self-references', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "app" {
  source = "terraform-aws-modules/ecs/aws"

  inputs = {
    name = component.app.cluster_name
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('ignores references to non-existent components', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "eks" {
  source = "terraform-aws-modules/eks/aws"

  inputs = {
    vpc_id = component.nonexistent.vpc_id
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.nodes).toHaveLength(1);
    expect(result.edges).toHaveLength(0);
  });

  it('concatenates content from multiple files', () => {
    const files = [
      makeFile(
        'networking.tfstack.hcl',
        `
component "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}
`
      ),
      makeFile(
        'compute.tfstack.hcl',
        `
component "eks" {
  source = "terraform-aws-modules/eks/aws"

  inputs = {
    vpc_id = component.vpc.vpc_id
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    expect(result.nodes).toHaveLength(2);
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]).toMatchObject({
      source: 'vpc',
      target: 'eks',
      type: 'implicit',
    });
  });

  describe('provider inference from source string', () => {
    it('infers aws from source containing "aws"', () => {
      const files = [
        makeFile('c.tfstack.hcl', 'component "x" { source = "terraform-aws-modules/vpc/aws" }'),
      ];
      const result = parseStacksDependencies(files, []);
      expect(result.nodes[0]?.provider).toBe('aws');
    });

    it('infers azure from source containing "azure"', () => {
      const files = [
        makeFile('c.tfstack.hcl', 'component "x" { source = "Azure/network/azurerm" }'),
      ];
      const result = parseStacksDependencies(files, []);
      expect(result.nodes[0]?.provider).toBe('azure');
    });

    it('infers gcp from source containing "google"', () => {
      const files = [
        makeFile(
          'c.tfstack.hcl',
          'component "x" { source = "terraform-google-modules/network/google" }'
        ),
      ];
      const result = parseStacksDependencies(files, []);
      expect(result.nodes[0]?.provider).toBe('gcp');
    });

    it('returns unknown for unrecognized source', () => {
      const files = [makeFile('c.tfstack.hcl', 'component "x" { source = "custom/module/foo" }')];
      const result = parseStacksDependencies(files, []);
      expect(result.nodes[0]?.provider).toBe('unknown');
    });

    it('prefers provider from matchedModule over source inference', () => {
      const files = [makeFile('c.tfstack.hcl', 'component "x" { source = "custom/module/foo" }')];
      const matched = [makeModuleMatch({ source: 'custom/module/foo', provider: 'Google Cloud' })];
      const result = parseStacksDependencies(files, matched);
      expect(result.nodes[0]?.provider).toBe('gcp');
    });
  });

  it('confidence comes from matchedModules lookup', () => {
    const files = [
      makeFile('c.tfstack.hcl', 'component "vpc" { source = "terraform-aws-modules/vpc/aws" }'),
    ];
    const matched = [
      makeModuleMatch({
        source: 'terraform-aws-modules/vpc/aws',
        confidence: 0.99,
      }),
    ];
    const result = parseStacksDependencies(files, matched);
    expect(result.nodes[0]?.confidence).toBe(0.99);
  });

  it('deduplicates edges between the same pair of components', () => {
    const files = [
      makeFile(
        'components.tfstack.hcl',
        `
component "vpc" {
  source = "terraform-aws-modules/vpc/aws"
}

component "eks" {
  source = "terraform-aws-modules/eks/aws"

  inputs = {
    vpc_id     = component.vpc.vpc_id
    subnet_ids = component.vpc.private_subnets
  }
}
`
      ),
    ];
    const result = parseStacksDependencies(files, []);
    // Only one edge from vpc->eks, with both outputs in the label
    expect(result.edges).toHaveLength(1);
    expect(result.edges[0]?.id).toBe('vpc->eks');
  });
});
