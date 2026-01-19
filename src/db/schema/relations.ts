import { relations } from 'drizzle-orm';
import { agentRuns } from './agent-runs';
import { agents } from './agents';
import { auditLogs } from './audit-logs';
import { githubInstallations, repositoryConfigs } from './github';
import { projects } from './projects';
import { sandboxConfigs } from './sandbox-configs';
import { sessions } from './sessions';
import { tasks } from './tasks';
import { templateProjects } from './template-projects';
import { templates } from './templates';
import { worktrees } from './worktrees';

export const projectsRelations = relations(projects, ({ one, many }) => ({
  tasks: many(tasks),
  agents: many(agents),
  sessions: many(sessions),
  worktrees: many(worktrees),
  auditLogs: many(auditLogs),
  templates: many(templates),
  templateProjects: many(templateProjects),
  sandboxConfig: one(sandboxConfigs, {
    fields: [projects.sandboxConfigId],
    references: [sandboxConfigs.id],
  }),
}));

export const sandboxConfigsRelations = relations(sandboxConfigs, ({ many }) => ({
  projects: many(projects),
}));

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  agent: one(agents, {
    fields: [tasks.agentId],
    references: [agents.id],
  }),
  session: one(sessions, {
    fields: [tasks.sessionId],
    references: [sessions.id],
  }),
  worktree: one(worktrees, {
    fields: [tasks.worktreeId],
    references: [worktrees.id],
  }),
  agentRuns: many(agentRuns),
  auditLogs: many(auditLogs),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  project: one(projects, {
    fields: [agents.projectId],
    references: [projects.id],
  }),
  tasks: many(tasks),
  agentRuns: many(agentRuns),
  sessions: many(sessions),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  project: one(projects, {
    fields: [sessions.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [sessions.taskId],
    references: [tasks.id],
  }),
  agent: one(agents, {
    fields: [sessions.agentId],
    references: [agents.id],
  }),
}));

export const worktreesRelations = relations(worktrees, ({ one }) => ({
  project: one(projects, {
    fields: [worktrees.projectId],
    references: [projects.id],
  }),
  task: one(tasks, {
    fields: [worktrees.taskId],
    references: [tasks.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one }) => ({
  agent: one(agents, {
    fields: [agentRuns.agentId],
    references: [agents.id],
  }),
  task: one(tasks, {
    fields: [agentRuns.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [agentRuns.projectId],
    references: [projects.id],
  }),
  session: one(sessions, {
    fields: [agentRuns.sessionId],
    references: [sessions.id],
  }),
}));

export const githubInstallationsRelations = relations(githubInstallations, ({ many }) => ({
  repositories: many(repositoryConfigs),
}));

export const repositoryConfigsRelations = relations(repositoryConfigs, ({ one }) => ({
  installation: one(githubInstallations, {
    fields: [repositoryConfigs.installationId],
    references: [githubInstallations.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  // Legacy single project reference (for backward compatibility)
  project: one(projects, {
    fields: [templates.projectId],
    references: [projects.id],
  }),
  // Many-to-many relationship through junction table
  templateProjects: many(templateProjects),
}));

export const templateProjectsRelations = relations(templateProjects, ({ one }) => ({
  template: one(templates, {
    fields: [templateProjects.templateId],
    references: [templates.id],
  }),
  project: one(projects, {
    fields: [templateProjects.projectId],
    references: [projects.id],
  }),
}));
