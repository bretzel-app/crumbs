import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';

const DATABASE_URL = process.env.DATABASE_URL || './data/crumbs.db';

// Ensure the data directory exists
const dir = dirname(DATABASE_URL);
if (!existsSync(dir)) {
	mkdirSync(dir, { recursive: true });
}

const sqlite = new Database(DATABASE_URL);

// Enable WAL mode for better concurrent read performance
sqlite.pragma('journal_mode = WAL');

// Disable foreign keys during schema setup to avoid constraint issues during migration
sqlite.pragma('foreign_keys = OFF');

// Auto-create tables on first run (new installs get full schema)
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		email TEXT NOT NULL DEFAULT '',
		display_name TEXT NOT NULL DEFAULT '',
		role TEXT NOT NULL DEFAULT 'user',
		password_hash TEXT,
		auth_provider TEXT NOT NULL DEFAULT 'password',
		provider_id TEXT,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id),
		expires_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL DEFAULT 0,
		title TEXT NOT NULL DEFAULT '',
		content TEXT NOT NULL DEFAULT '',
		color TEXT NOT NULL DEFAULT 'default',
		pinned INTEGER NOT NULL DEFAULT 0,
		archived INTEGER NOT NULL DEFAULT 0,
		trashed INTEGER NOT NULL DEFAULT 0,
		trashed_at INTEGER,
		checklist_mode INTEGER NOT NULL DEFAULT 0,
		sort_order INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL,
		updated_at INTEGER NOT NULL,
		version INTEGER NOT NULL DEFAULT 1
	);

	CREATE TABLE IF NOT EXISTS tags (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL DEFAULT 0,
		name TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS note_tags (
		note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL DEFAULT 0,
		note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
		filename TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		path TEXT NOT NULL,
		thumbnail_path TEXT,
		featured INTEGER NOT NULL DEFAULT 0,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS sync_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL DEFAULT 0,
		note_id TEXT NOT NULL,
		operation TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		client_id TEXT NOT NULL
	);

	CREATE TABLE IF NOT EXISTS login_attempts (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		ip TEXT NOT NULL,
		email TEXT NOT NULL,
		success INTEGER NOT NULL,
		timestamp INTEGER NOT NULL
	);
`);

// Migration: detect old schema (no email column on users) and add columns
const userColumns = sqlite
	.prepare("PRAGMA table_info('users')")
	.all() as { name: string }[];
const hasEmail = userColumns.some((col) => col.name === 'email');

if (!hasEmail) {
	sqlite.exec(`
		ALTER TABLE users ADD COLUMN email TEXT NOT NULL DEFAULT '';
		ALTER TABLE users ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
		ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
		ALTER TABLE users ADD COLUMN auth_provider TEXT NOT NULL DEFAULT 'password';
		ALTER TABLE users ADD COLUMN provider_id TEXT;
	`);
}

// Ensure user_id column exists on data tables (migration from old schema)
const notesColumns = sqlite
	.prepare("PRAGMA table_info('notes')")
	.all() as { name: string }[];
if (!notesColumns.some((col) => col.name === 'user_id')) {
	sqlite.exec(`
		ALTER TABLE notes ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE tags ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE attachments ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
		ALTER TABLE sync_log ADD COLUMN user_id INTEGER NOT NULL DEFAULT 0;
	`);
}

// Backfill: promote existing user to admin and assign all data to them
if (!hasEmail) {
	const existingUser = sqlite.prepare('SELECT id FROM users LIMIT 1').get() as
		| { id: number }
		| undefined;
	if (existingUser) {
		const uid = existingUser.id;
		sqlite.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', uid);
		for (const table of ['notes', 'tags', 'attachments', 'sync_log']) {
			sqlite.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = 0`).run(uid);
		}
	}
}

// Create indexes AFTER migration ensures columns exist
sqlite.exec(`
	CREATE INDEX IF NOT EXISTS notes_user_id_idx ON notes(user_id);
	CREATE INDEX IF NOT EXISTS notes_trashed_archived_idx ON notes(trashed, archived);
	CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at);
	CREATE INDEX IF NOT EXISTS note_tags_note_id_idx ON note_tags(note_id);
	CREATE INDEX IF NOT EXISTS note_tags_tag_id_idx ON note_tags(tag_id);
	CREATE INDEX IF NOT EXISTS sync_log_timestamp_idx ON sync_log(timestamp);
	CREATE INDEX IF NOT EXISTS login_attempts_ip_timestamp_idx ON login_attempts(ip, timestamp);
`);

// Replace old tags unique index with compound index including user_id
try {
	sqlite.exec(`DROP INDEX IF EXISTS tags_name_unique`);
} catch {
	// ignore
}
sqlite.exec(
	`CREATE UNIQUE INDEX IF NOT EXISTS tags_name_user_unique ON tags(name, user_id)`
);

// Idempotent migrations: add columns that may be missing from older DBs
try {
	sqlite.exec(`ALTER TABLE attachments ADD COLUMN thumbnail_path TEXT;`);
} catch {
	// Column already exists
}
try {
	sqlite.exec(`ALTER TABLE attachments ADD COLUMN featured INTEGER NOT NULL DEFAULT 0;`);
} catch {
	// Column already exists
}

// Re-enable foreign keys
sqlite.pragma('foreign_keys = ON');

export const db = drizzle(sqlite, { schema });
export { sqlite };
