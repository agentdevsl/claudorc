import { createId } from '@paralleldrive/cuid2';
import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { SANDBOX_TYPES, type SandboxType } from '../shared/enums';

export type { SandboxType };
export { SANDBOX_TYPES };

export const sandboxConfigs = pgTable('sandbox_configs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').$type<SandboxType>().notNull().default('docker'),
  isDefault: boolean('is_default').default(false),
  baseImage: text('base_image').notNull().default('node:22-slim'),
  memoryMb: integer('memory_mb').notNull().default(4096),
  cpuCores: doublePrecision('cpu_cores').notNull().default(2.0),
  maxProcesses: integer('max_processes').notNull().default(256),
  timeoutMinutes: integer('timeout_minutes').notNull().default(60),
  volumeMountPath: text('volume_mount_path'),
  kubeConfigPath: text('kube_config_path'),
  kubeContext: text('kube_context'),
  kubeNamespace: text('kube_namespace').default('agentpane-sandboxes'),
  networkPolicyEnabled: boolean('network_policy_enabled').default(true),
  allowedEgressHosts: jsonb('allowed_egress_hosts').$type<string[]>(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export type SandboxConfig = typeof sandboxConfigs.$inferSelect;
export type NewSandboxConfig = typeof sandboxConfigs.$inferInsert;
