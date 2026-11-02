import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

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

export const workspaceAccount = sqliteTable('workspace_account', {
  id: integer('id').primaryKey(),
  username: text('username').notNull(),
  salt: text('salt').notNull(),
  passwordHash: text('password_hash').notNull(),
  iterations: integer('iterations').notNull(),
  ownerId: text('owner_id').notNull(),
  createdAt: integer('created_at').notNull(),
}, table => [check('only_one_workspace_account', sql`${table.id} = 1`)]);

export const workspaceSessions = sqliteTable('workspace_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  expiresAt: integer('expires_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const workspaceLoginAttempts = sqliteTable('workspace_login_attempts', {
  key: text('key').primaryKey(),
  windowStart: integer('window_start').notNull(),
  attempts: integer('attempts').notNull(),
});
