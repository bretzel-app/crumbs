import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

/**
 * Create an in-memory SQLite database for testing.
 * Each test gets a fresh database.
 */
export function createTestDb() {
	const sqlite = new Database(':memory:');
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = OFF');

	// Create tables matching the multi-user schema
	sqlite.exec(`
		CREATE TABLE users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL DEFAULT '',
			display_name TEXT NOT NULL DEFAULT '',
			role TEXT NOT NULL DEFAULT 'user',
			password_hash TEXT,
			auth_provider TEXT NOT NULL DEFAULT 'password',
			provider_id TEXT,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id),
			expires_at INTEGER NOT NULL,
			created_at INTEGER,
			user_agent TEXT,
			ip TEXT,
			last_used_at INTEGER
		);

		CREATE TABLE notes (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),
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
		CREATE INDEX notes_user_id_idx ON notes(user_id);
		CREATE INDEX notes_trashed_archived_idx ON notes(trashed, archived);
		CREATE INDEX notes_updated_at_idx ON notes(updated_at);

		CREATE TABLE tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),
			name TEXT NOT NULL
		);
		CREATE UNIQUE INDEX tags_name_user_unique ON tags(name, user_id);

		CREATE TABLE note_tags (
			note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE
		);
		CREATE INDEX note_tags_note_id_idx ON note_tags(note_id);
		CREATE INDEX note_tags_tag_id_idx ON note_tags(tag_id);

		CREATE TABLE attachments (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),
			note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
			filename TEXT NOT NULL,
			mime_type TEXT NOT NULL,
			size INTEGER NOT NULL,
			path TEXT NOT NULL,
			created_at INTEGER NOT NULL
		);

		CREATE TABLE sync_log (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER NOT NULL DEFAULT 0 REFERENCES users(id),
			note_id TEXT NOT NULL REFERENCES notes(id),
			operation TEXT NOT NULL,
			timestamp INTEGER NOT NULL,
			client_id TEXT NOT NULL
		);
		CREATE INDEX sync_log_timestamp_idx ON sync_log(timestamp);

		CREATE TABLE login_attempts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip TEXT NOT NULL,
			email TEXT NOT NULL,
			success INTEGER NOT NULL,
			timestamp INTEGER NOT NULL
		);
		CREATE INDEX login_attempts_ip_timestamp_idx ON login_attempts(ip, timestamp);
	`);

	const db = drizzle(sqlite, { schema });
	return { db, sqlite };
}
