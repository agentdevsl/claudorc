import { describe, expect, it } from 'vitest';
import { generateTfvars } from '../../../src/lib/terraform/generate-tfvars';
import type { ParsedHclVariable } from '../../../src/lib/terraform/parse-hcl-variables';

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

describe('generateTfvars', () => {
  it('returns empty string for empty values', () => {
    const vars = [makeVar({ name: 'region' })];
    const result = generateTfvars(vars, {});
    expect(result).toBe('');
  });

  it('returns empty string for empty variables array', () => {
    const result = generateTfvars([], { region: 'us-east-1' });
    expect(result).toBe('');
  });

  it('quotes string values', () => {
    const vars = [makeVar({ name: 'region', normalizedType: 'string' })];
    const result = generateTfvars(vars, { region: 'us-east-1' });
    expect(result).toContain('region = "us-east-1"');
  });

  it('does not double-quote already quoted strings', () => {
    const vars = [makeVar({ name: 'region', normalizedType: 'string' })];
    const result = generateTfvars(vars, { region: '"us-east-1"' });
    expect(result).toContain('region = "us-east-1"');
    // Should not contain triple quotes
    expect(result).not.toContain('""');
  });

  it('does not quote number values', () => {
    const vars = [makeVar({ name: 'count', normalizedType: 'number' })];
    const result = generateTfvars(vars, { count: '3' });
    expect(result).toContain('count = 3');
    expect(result).not.toContain('"3"');
  });

  it('does not quote bool values', () => {
    const vars = [makeVar({ name: 'enable', normalizedType: 'bool' })];
    const result = generateTfvars(vars, { enable: 'true' });
    expect(result).toContain('enable = true');
    expect(result).not.toContain('"true"');
  });

  it('passes list values through as-is', () => {
    const vars = [makeVar({ name: 'zones', normalizedType: 'list' })];
    const result = generateTfvars(vars, { zones: '["us-east-1a", "us-east-1b"]' });
    expect(result).toContain('zones = ["us-east-1a", "us-east-1b"]');
  });

  it('passes map values through as-is', () => {
    const vars = [makeVar({ name: 'tags', normalizedType: 'map' })];
    const result = generateTfvars(vars, { tags: '{ Name = "test" }' });
    expect(result).toContain('tags = { Name = "test" }');
  });

  it('passes object values through as-is', () => {
    const vars = [makeVar({ name: 'config', normalizedType: 'object' })];
    const result = generateTfvars(vars, { config: '{ port = 8080 }' });
    expect(result).toContain('config = { port = 8080 }');
  });

  it('skips empty string values', () => {
    const vars = [
      makeVar({ name: 'region', normalizedType: 'string' }),
      makeVar({ name: 'name', normalizedType: 'string' }),
    ];
    const result = generateTfvars(vars, { region: '', name: 'myapp' });
    expect(result).not.toContain('region');
    expect(result).toContain('name = "myapp"');
  });

  it('skips undefined values', () => {
    const vars = [
      makeVar({ name: 'region', normalizedType: 'string' }),
      makeVar({ name: 'name', normalizedType: 'string' }),
    ];
    const result = generateTfvars(vars, { name: 'myapp' });
    expect(result).not.toContain('region');
    expect(result).toContain('name = "myapp"');
  });

  it('includes description as a comment above the variable', () => {
    const vars = [
      makeVar({ name: 'region', normalizedType: 'string', description: 'AWS region to deploy to' }),
    ];
    const result = generateTfvars(vars, { region: 'us-west-2' });
    expect(result).toContain('# AWS region to deploy to');
    // Comment should appear before the variable assignment
    const lines = result.split('\n');
    const commentIdx = lines.findIndex((l) => l.includes('# AWS region to deploy to'));
    const varIdx = lines.findIndex((l) => l.includes('region ='));
    expect(commentIdx).toBeLessThan(varIdx);
  });

  it('does not include comment when description is null', () => {
    const vars = [makeVar({ name: 'region', normalizedType: 'string', description: null })];
    const result = generateTfvars(vars, { region: 'us-east-1' });
    expect(result).not.toContain('#');
  });

  it('generates multiple variable assignments', () => {
    const vars = [
      makeVar({ name: 'region', normalizedType: 'string', description: 'AWS region' }),
      makeVar({ name: 'instance_count', normalizedType: 'number' }),
      makeVar({ name: 'enable_dns', normalizedType: 'bool' }),
    ];
    const values = { region: 'us-east-1', instance_count: '2', enable_dns: 'false' };
    const result = generateTfvars(vars, values);
    expect(result).toContain('region = "us-east-1"');
    expect(result).toContain('instance_count = 2');
    expect(result).toContain('enable_dns = false');
    expect(result).toContain('# AWS region');
  });

  it('quotes unknown type values as strings', () => {
    const vars = [makeVar({ name: 'custom', normalizedType: 'unknown' })];
    const result = generateTfvars(vars, { custom: 'some-value' });
    expect(result).toContain('custom = "some-value"');
  });

  it('result has no trailing newline', () => {
    const vars = [makeVar({ name: 'name', normalizedType: 'string' })];
    const result = generateTfvars(vars, { name: 'test' });
    expect(result).not.toMatch(/\n$/);
  });
});
