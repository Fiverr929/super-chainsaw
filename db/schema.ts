import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const workspaceEntries = sqliteTable('workspace_entries', {
  owner: text('owner').notNull(),
  path: text('path').notNull(),
  kind: text('kind').notNull(),
  data: text('data'),
  objectKey: text('object_key'),
  size: integer('size').notNull(),
  modified: integer('modified').notNull(),
  revision: text('revision').notNull(),
}, table => [primaryKey({ columns: [table.owner, table.path] })]);
