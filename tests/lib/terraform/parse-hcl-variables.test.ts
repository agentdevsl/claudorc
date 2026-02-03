import { describe, expect, it } from 'vitest';
import type { ParsedHclVariable } from '../../../src/lib/terraform/parse-hcl-variables';
import {
  inferSmartWidget,
  normalizeVariableType,
  parseHclVariables,
} from '../../../src/lib/terraform/parse-hcl-variables';

describe('parseHclVariables', () => {
  it('returns empty array for empty code', () => {
    expect(parseHclVariables('')).toEqual([]);
  });

  it('returns empty array for code with no variable blocks', () => {
    const code = `
      resource "aws_instance" "web" {
        ami = "abc-123"
      }
    `;
    expect(parseHclVariables(code)).toEqual([]);
  });

  it('parses a single string variable', () => {
    const code = `
variable "name" {
  type = string
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'name',
      type: 'string',
      normalizedType: 'string',
      description: null,
      default: null,
      sensitive: false,
      required: true,
    });
  });

  it('parses variable with type, description, default, and sensitive', () => {
    const code = `
variable "db_password" {
  type        = string
  description = "The database password"
  default     = "changeme"
  sensitive   = true
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'db_password',
      type: 'string',
      normalizedType: 'string',
      description: 'The database password',
      default: 'changeme',
      sensitive: true,
      required: false,
    });
  });

  it('marks variable as required when no default is present', () => {
    const code = `
variable "required_var" {
  type = string
}

variable "optional_var" {
  type    = string
  default = "hello"
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(2);
    expect(result[0]?.required).toBe(true);
    expect(result[1]?.required).toBe(false);
  });

  it('parses list(string) type', () => {
    const code = `
variable "availability_zones" {
  type    = list(string)
  default = ["us-east-1a", "us-east-1b"]
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'availability_zones',
      type: 'list(string)',
      normalizedType: 'list',
      required: false,
    });
  });

  it('parses map(string) type', () => {
    const code = `
variable "tags" {
  type = map(string)
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'map(string)',
      normalizedType: 'map',
    });
  });

  it('parses object type', () => {
    const code = `
variable "config" {
  type = object({
    name = string
    port = number
  })
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]?.normalizedType).toBe('object');
    // The raw type should contain the full object expression
    expect(result[0]?.type).toContain('object');
  });

  it('parses bool type correctly', () => {
    const code = `
variable "enable_monitoring" {
  type    = bool
  default = true
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'bool',
      normalizedType: 'bool',
      default: 'true',
      required: false,
    });
  });

  it('parses number type with numeric default', () => {
    const code = `
variable "instance_count" {
  type    = number
  default = 3
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'number',
      normalizedType: 'number',
      default: '3',
    });
  });

  it('parses multiple variables', () => {
    const code = `
variable "region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Deployment environment"
}

variable "enable_dns" {
  type    = bool
  default = true
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(3);
    expect(result.map((v) => v.name)).toEqual(['region', 'environment', 'enable_dns']);
  });

  it('defaults to string type when type is not specified', () => {
    const code = `
variable "simple" {
  description = "A simple variable"
}
`;
    const result = parseHclVariables(code);
    expect(result).toHaveLength(1);
    expect(result[0]?.type).toBe('string');
    expect(result[0]?.normalizedType).toBe('string');
  });
});

describe('normalizeVariableType', () => {
  it('normalizes string', () => {
    expect(normalizeVariableType('string')).toBe('string');
  });

  it('normalizes number', () => {
    expect(normalizeVariableType('number')).toBe('number');
  });

  it('normalizes bool', () => {
    expect(normalizeVariableType('bool')).toBe('bool');
  });

  it('normalizes list(string) to list', () => {
    expect(normalizeVariableType('list(string)')).toBe('list');
  });

  it('normalizes set(string) to list', () => {
    expect(normalizeVariableType('set(string)')).toBe('list');
  });

  it('normalizes tuple to list', () => {
    expect(normalizeVariableType('tuple([string, number])')).toBe('list');
  });

  it('normalizes map(string) to map', () => {
    expect(normalizeVariableType('map(string)')).toBe('map');
  });

  it('normalizes object({...}) to object', () => {
    expect(normalizeVariableType('object({ name = string })')).toBe('object');
  });

  it('returns unknown for unrecognized types', () => {
    expect(normalizeVariableType('any')).toBe('unknown');
    expect(normalizeVariableType('custom_type')).toBe('unknown');
  });

  it('is case-insensitive', () => {
    expect(normalizeVariableType('String')).toBe('string');
    expect(normalizeVariableType('BOOL')).toBe('bool');
    expect(normalizeVariableType('List(string)')).toBe('list');
  });

  it('trims whitespace', () => {
    expect(normalizeVariableType('  string  ')).toBe('string');
    expect(normalizeVariableType(' list(string) ')).toBe('list');
  });
});

describe('inferSmartWidget', () => {
  function makeVar(overrides: Partial<ParsedHclVariable> = {}): ParsedHclVariable {
    return {
      name: 'test_var',
      type: 'string',
      normalizedType: 'string',
      description: null,
      default: null,
      sensitive: false,
      required: true,
      ...overrides,
    };
  }

  it('returns switch for bool type', () => {
    const widget = inferSmartWidget(makeVar({ name: 'anything', normalizedType: 'bool' }));
    expect(widget).toEqual({ kind: 'switch' });
  });

  it('returns select with regions for variable named "region"', () => {
    const widget = inferSmartWidget(makeVar({ name: 'aws_region' }));
    expect(widget).not.toBeNull();
    expect(widget?.kind).toBe('select');
    expect(widget?.options).toContain('us-east-1');
    expect(widget?.options).toContain('eu-west-1');
  });

  it('returns select with environments for variable named "environment"', () => {
    const widget = inferSmartWidget(makeVar({ name: 'environment' }));
    expect(widget).not.toBeNull();
    expect(widget?.kind).toBe('select');
    expect(widget?.options).toContain('production');
    expect(widget?.options).toContain('staging');
    expect(widget?.options).toContain('development');
  });

  it('returns select for variable ending with _env', () => {
    const widget = inferSmartWidget(makeVar({ name: 'deploy_env' }));
    expect(widget?.kind).toBe('select');
    expect(widget?.options).toContain('production');
  });

  it('returns select for variable named exactly "env"', () => {
    const widget = inferSmartWidget(makeVar({ name: 'env' }));
    expect(widget?.kind).toBe('select');
  });

  it('returns select with instance types for "instance_type"', () => {
    const widget = inferSmartWidget(makeVar({ name: 'instance_type' }));
    expect(widget).not.toBeNull();
    expect(widget?.kind).toBe('select');
    expect(widget?.options).toContain('t3.micro');
    expect(widget?.options).toContain('m5.large');
  });

  it('returns text with CIDR placeholder for cidr variable', () => {
    const widget = inferSmartWidget(makeVar({ name: 'vpc_cidr' }));
    expect(widget).not.toBeNull();
    expect(widget?.kind).toBe('text');
    expect(widget?.placeholder).toBe('10.0.0.0/16');
  });

  it('returns text with CIDR placeholder for subnet variable', () => {
    const widget = inferSmartWidget(makeVar({ name: 'private_subnet' }));
    expect(widget?.kind).toBe('text');
    expect(widget?.placeholder).toBe('10.0.0.0/16');
  });

  it('returns null for unrecognized variable names', () => {
    const widget = inferSmartWidget(makeVar({ name: 'project_name' }));
    expect(widget).toBeNull();
  });

  it('bool check takes priority over name-based inference', () => {
    // Even if the name contains "region", bool type should win
    const widget = inferSmartWidget(
      makeVar({ name: 'enable_region_check', normalizedType: 'bool' })
    );
    expect(widget?.kind).toBe('switch');
  });
});
