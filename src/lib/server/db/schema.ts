import { sqliteTable, text, integer, uniqueIndex, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	email: text('email').notNull().default(''),
	displayName: text('display_name').notNull().default(''),
	role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
	passwordHash: text('password_hash'),
	authProvider: text('auth_provider').notNull().default('password'),
	providerId: text('provider_id'),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }),
	userAgent: text('user_agent'),
	ip: text('ip'),
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' })
});

export const notes = sqliteTable(
	'notes',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull()
			.default(0),
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
		index('notes_user_id_idx').on(table.userId),
		index('notes_trashed_archived_idx').on(table.trashed, table.archived),
		index('notes_updated_at_idx').on(table.updatedAt)
	]
);

export const tags = sqliteTable(
	'tags',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull()
			.default(0),
		name: text('name').notNull()
	},
	(table) => [uniqueIndex('tags_name_user_unique').on(table.name, table.userId)]
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
	userId: integer('user_id')
		.references(() => users.id)
		.notNull()
		.default(0),
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

export const apiKeys = sqliteTable('api_keys', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.references(() => users.id)
		.notNull(),
	name: text('name').notNull(),
	keyHash: text('key_hash').notNull(),
	keyPrefix: text('key_prefix').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	lastUsedAt: integer('last_used_at', { mode: 'timestamp' })
});

export const syncLog = sqliteTable(
	'sync_log',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull()
			.default(0),
		noteId: text('note_id')
			.references(() => notes.id)
			.notNull(),
		operation: text('operation').notNull(),
		timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
		clientId: text('client_id').notNull()
	},
	(table) => [index('sync_log_timestamp_idx').on(table.timestamp)]
);

export const noteCollaborators = sqliteTable(
	'note_collaborators',
	{
		noteId: text('note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull(),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		addedBy: integer('added_by')
			.references(() => users.id)
			.notNull(),
		addedAt: integer('added_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		uniqueIndex('note_collaborators_unique').on(table.noteId, table.userId),
		index('note_collaborators_user_id_idx').on(table.userId)
	]
);

export const noteUserState = sqliteTable(
	'note_user_state',
	{
		noteId: text('note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull(),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		pinned: integer('pinned', { mode: 'boolean' }).default(false).notNull(),
		archived: integer('archived', { mode: 'boolean' }).default(false).notNull(),
		sortOrder: integer('sort_order').default(0).notNull()
	},
	(table) => [uniqueIndex('note_user_state_unique').on(table.noteId, table.userId)]
);

export const loginAttempts = sqliteTable(
	'login_attempts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		ip: text('ip').notNull(),
		email: text('email').notNull(),
		success: integer('success', { mode: 'boolean' }).notNull(),
		timestamp: integer('timestamp', { mode: 'timestamp' }).notNull()
	},
	(table) => [index('login_attempts_ip_timestamp_idx').on(table.ip, table.timestamp)]
);

export const userPreferences = sqliteTable(
	'user_preferences',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.references(() => users.id)
			.notNull(),
		key: text('key').notNull(),
		value: text('value').notNull(),
		updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [uniqueIndex('user_preferences_user_key_unique').on(table.userId, table.key)]
);

export const sharedNotes = sqliteTable('shared_notes', {
	noteId: text('note_id')
		.primaryKey()
		.references(() => notes.id, { onDelete: 'cascade' }),
	token: text('token').notNull().unique(),
	createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
	expiresAt: integer('expires_at', { mode: 'timestamp' })
});

export const noteVersions = sqliteTable(
	'note_versions',
	{
		id: text('id').primaryKey(),
		noteId: text('note_id')
			.references(() => notes.id, { onDelete: 'cascade' })
			.notNull(),
		version: integer('version').notNull(),
		title: text('title').notNull().default(''),
		content: text('content').notNull().default(''),
		checklistMode: integer('checklist_mode', { mode: 'boolean' }).notNull().default(false),
		color: text('color').notNull().default('default'),
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		index('note_versions_note_id_idx').on(table.noteId),
		uniqueIndex('note_versions_note_id_version_unique').on(table.noteId, table.version)
	]
);
