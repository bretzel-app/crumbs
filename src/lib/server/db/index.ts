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
sqlite.pragma('foreign_keys = ON');

// Auto-create tables on first run
sqlite.exec(`
	CREATE TABLE IF NOT EXISTS users (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		password_hash TEXT NOT NULL,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS sessions (
		id TEXT PRIMARY KEY,
		user_id INTEGER NOT NULL REFERENCES users(id),
		expires_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS notes (
		id TEXT PRIMARY KEY,
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
		name TEXT NOT NULL
	);
	CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique ON tags(name);

	CREATE TABLE IF NOT EXISTS note_tags (
		note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
		tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS attachments (
		id TEXT PRIMARY KEY,
		note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
		filename TEXT NOT NULL,
		mime_type TEXT NOT NULL,
		size INTEGER NOT NULL,
		path TEXT NOT NULL,
		thumbnail_path TEXT,
		created_at INTEGER NOT NULL
	);

	CREATE TABLE IF NOT EXISTS sync_log (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		note_id TEXT NOT NULL REFERENCES notes(id),
		operation TEXT NOT NULL,
		timestamp INTEGER NOT NULL,
		client_id TEXT NOT NULL
	);

	CREATE INDEX IF NOT EXISTS notes_trashed_archived_idx ON notes(trashed, archived);
	CREATE INDEX IF NOT EXISTS notes_updated_at_idx ON notes(updated_at);
	CREATE INDEX IF NOT EXISTS note_tags_note_id_idx ON note_tags(note_id);
	CREATE INDEX IF NOT EXISTS note_tags_tag_id_idx ON note_tags(tag_id);
	CREATE INDEX IF NOT EXISTS sync_log_timestamp_idx ON sync_log(timestamp);
`);

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

export const db = drizzle(sqlite, { schema });
export { sqlite };
