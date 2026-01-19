import { sql } from 'drizzle-orm';
import { primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { projects } from './projects.js';
import { templates } from './templates.js';

/**
 * Junction table for many-to-many relationship between templates and projects.
 * Allows a project-scoped template to be associated with multiple projects.
 */
export const templateProjects = sqliteTable(
  'template_projects',
  {
    templateId: text('template_id')
      .notNull()
      .references(() => templates.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    createdAt: text('created_at').default(sql`(datetime('now'))`).notNull(),
  },
  (table) => [primaryKey({ columns: [table.templateId, table.projectId] })]
);

export type TemplateProject = typeof templateProjects.$inferSelect;
export type NewTemplateProject = typeof templateProjects.$inferInsert;
