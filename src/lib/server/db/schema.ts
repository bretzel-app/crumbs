import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	passwordHash: text('password_hash').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull()
});

export const notes = sqliteTable(
	'notes',
	{
		id: text('id').primaryKey(),
		title: text('title').default('').notNull(),
		content: text('content').default('').notNull(),
		color: text('color').default('default').notNull(),
		pinned: integer('pinned', { mode: 'boolean' }).default(false).notNull(),
		archived: integer('archived', { mode: 'boolean' }).default(false).notNull(),
		trashed: integer('trashed', { mode: 'boolean' }).default(false).notNull(),
		trashedAt: integer('trashed_at', { mode: 'timestamp' }),
		checklistMode: integer('checklist_mode', { mode: 'boolean' }).default(false).notNull(),
		sortOrder: integer('sort_order').default(0).notNull(),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
		version: integer('version').default(1).notNull()
	},
	(table) => [
		index('notes_trashed_archived_idx').on(table.trashed, table.archived),
		index('notes_updated_at_idx').on(table.updatedAt)
	]
);

export const tags = sqliteTable(
	'tags',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		name: text('name').notNull()
	},
	(table) => [uniqueIndex('tags_name_unique').on(table.name)]
);

export const noteTags = sqliteTable(
	'note_tags',
	{
		noteId: text('note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull(),
		tagId: integer('tag_id')
			.references(() => tags.id, { onDelete: 'cascade' })
			.notNull()
	},
	(table) => [
		index('note_tags_note_id_idx').on(table.noteId),
		index('note_tags_tag_id_idx').on(table.tagId)
	]
);

export const attachments = sqliteTable('attachments', {
	id: text('id').primaryKey(),
	noteId: text('note_id')
		.references(() => notes.id, { onDelete: 'cascade' })
		.notNull(),
	filename: text('filename').notNull(),
	mimeType: text('mime_type').notNull(),
	size: integer('size').notNull(),
	path: text('path').notNull(),
	thumbnailPath: text('thumbnail_path'),
	featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const syncLog = sqliteTable(
	'sync_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		noteId: text('note_id')
			.references(() => notes.id)
			.notNull(),
		operation: text('operation').notNull(),
		timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
		clientId: text('client_id').notNull()
	},
	(table) => [index('sync_log_timestamp_idx').on(table.timestamp)]
);
