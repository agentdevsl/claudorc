import { pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { projects } from './projects';
import { templates } from './templates';

export const templateProjects = pgTable(
  'template_projects',
  {
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.projectId] })]
);

export type TemplateProject = typeof templateProjects.$inferSelect;
export type NewTemplateProject = typeof templateProjects.$inferInsert;
