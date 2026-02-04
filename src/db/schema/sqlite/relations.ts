import { relations } from 'drizzle-orm';
import { agentRuns } from './agent-runs';
import { agents } from './agents';
import { auditLogs } from './audit-logs';
import { githubInstallations, repositoryConfigs } from './github';
import { planSessions } from './plan-sessions';
import { projects } from './projects';
import { sandboxConfigs } from './sandbox-configs';
import { sandboxInstances, sandboxTmuxSessions } from './sandboxes';
import { sessionEvents } from './session-events';
import { sessionSummaries } from './session-summaries';
import { sessions } from './sessions';
import { tasks } from './tasks';
import { templateProjects } from './template-projects';
import { templates } from './templates';
import { terraformModules, terraformRegistries } from './terraform';
import { worktrees } from './worktrees';

export const projectsRelations = relations(projects, ({ one, many }) => ({
  tasks: many(tasks),
  agents: many(agents),
  sessions: many(sessions),
  worktrees: many(worktrees),
  auditLogs: many(auditLogs),
  templates: many(templates),
  templateProjects: many(templateProjects),
  planSessions: many(planSessions),
  sandboxInstance: one(sandboxInstances, {
    fields: [projects.id],
    references: [sandboxInstances.projectId],
  }),
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
  planSessions: many(planSessions),
  tmuxSessions: many(sandboxTmuxSessions),
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

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
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
  events: many(sessionEvents),
  summary: one(sessionSummaries, {
    fields: [sessions.id],
    references: [sessionSummaries.sessionId],
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

// Plan sessions relations
export const planSessionsRelations = relations(planSessions, ({ one }) => ({
  task: one(tasks, {
    fields: [planSessions.taskId],
    references: [tasks.id],
  }),
  project: one(projects, {
    fields: [planSessions.projectId],
    references: [projects.id],
  }),
}));

// Sandbox instances relations
export const sandboxInstancesRelations = relations(sandboxInstances, ({ one, many }) => ({
  project: one(projects, {
    fields: [sandboxInstances.projectId],
    references: [projects.id],
  }),
  tmuxSessions: many(sandboxTmuxSessions),
}));

// Sandbox tmux sessions relations
export const sandboxTmuxSessionsRelations = relations(sandboxTmuxSessions, ({ one }) => ({
  sandbox: one(sandboxInstances, {
    fields: [sandboxTmuxSessions.sandboxId],
    references: [sandboxInstances.id],
  }),
  task: one(tasks, {
    fields: [sandboxTmuxSessions.taskId],
    references: [tasks.id],
  }),
}));

// Session events relations
export const sessionEventsRelations = relations(sessionEvents, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionEvents.sessionId],
    references: [sessions.id],
  }),
}));

// Session summaries relations
export const sessionSummariesRelations = relations(sessionSummaries, ({ one }) => ({
  session: one(sessions, {
    fields: [sessionSummaries.sessionId],
    references: [sessions.id],
  }),
}));

// Terraform registries relations
export const terraformRegistriesRelations = relations(terraformRegistries, ({ many }) => ({
  modules: many(terraformModules),
}));

// Terraform modules relations
export const terraformModulesRelations = relations(terraformModules, ({ one }) => ({
  registry: one(terraformRegistries, {
    fields: [terraformModules.registryId],
    references: [terraformRegistries.id],
  }),
}));
