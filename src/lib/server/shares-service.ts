import type { Db } from './db/index.js';
import { sharedNotes, notes, attachments } from './db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { requireNoteOwnership } from './api-utils.js';
import type { SharedNoteData, Attachment } from '$lib/types/index.js';

/**
 * Batch fetch share tokens for multiple notes.
 * Returns a Map of noteId → token.
 */
export function fetchSharesForNotes(db: Db, noteIds: string[]): Map<string, string> {
	if (noteIds.length === 0) return new Map();

	const rows = db
		.select({ noteId: sharedNotes.noteId, token: sharedNotes.token })
		.from(sharedNotes)
		.where(inArray(sharedNotes.noteId, noteIds))
		.all();

	const map = new Map<string, string>();
	for (const row of rows) {
		map.set(row.noteId, row.token);
	}
	return map;
}

/**
 * Create a public share link for a note. Idempotent — returns existing token if already shared.
 */
export function createShare(db: Db, noteId: string, userId: number): { token: string } {
	requireNoteOwnership(db, noteId, userId);

	const existing = db
		.select({ token: sharedNotes.token })
		.from(sharedNotes)
		.where(eq(sharedNotes.noteId, noteId))
		.get();

	if (existing) return { token: existing.token };

	const token = nanoid(21);
	db.insert(sharedNotes)
		.values({ noteId, token, createdAt: new Date() })
		.run();

	return { token };
}

/**
 * Revoke a public share link for a note.
 */
export function revokeShare(db: Db, noteId: string, userId: number): void {
	requireNoteOwnership(db, noteId, userId);

	db.delete(sharedNotes)
		.where(eq(sharedNotes.noteId, noteId))
		.run();
}

/**
 * Get share info for a specific note.
 */
export function getShareByNoteId(db: Db, noteId: string) {
	return db
		.select()
		.from(sharedNotes)
		.where(eq(sharedNotes.noteId, noteId))
		.get() ?? null;
}

/**
 * Get a shared note by its public token. Returns null if note is trashed or token is invalid.
 */
export function getSharedNote(db: Db, token: string): (SharedNoteData & { noteId: string }) | null {
	const share = db
		.select()
		.from(sharedNotes)
		.where(eq(sharedNotes.token, token))
		.get();

	if (!share) return null;

	const note = db
		.select()
		.from(notes)
		.where(and(eq(notes.id, share.noteId), eq(notes.trashed, false)))
		.get();

	if (!note) return null;

	const noteAttachments = db
		.select()
		.from(attachments)
		.where(eq(attachments.noteId, share.noteId))
		.all() as Attachment[];

	return {
		noteId: note.id,
		title: note.title,
		content: note.content,
		checklistMode: note.checklistMode,
		color: note.color as SharedNoteData['color'],
		attachments: noteAttachments,
		createdAt: note.createdAt,
		updatedAt: note.updatedAt
	};
}
