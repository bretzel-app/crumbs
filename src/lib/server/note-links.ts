import type { Db } from './db/index.js';
import { noteLinks, notes } from './db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import { canAccessNote } from './api-utils.js';

/**
 * Sync link rows for a note: removes old associations, inserts the current set.
 * Mirrors syncNoteTags — called right after a note's content is saved.
 */
export function syncNoteLinks(db: Db, noteId: string, targetIds: string[]): void {
	db.delete(noteLinks).where(eq(noteLinks.sourceNoteId, noteId)).run();

	for (const targetId of targetIds) {
		db.insert(noteLinks).values({ sourceNoteId: noteId, targetNoteId: targetId }).run();
	}
}

/**
 * Find notes that link to the given note, scoped to what the requesting user
 * can access — this both respects normal sharing boundaries and, as a side
 * effect, prevents an unrelated note from appearing in someone's backlinks
 * just because it happens to reference a note ID it was never shared to see.
 */
export function fetchBacklinksForNote(
	db: Db,
	noteId: string,
	userId: number
): { id: string; title: string }[] {
	const linkRows = db
		.select({ sourceNoteId: noteLinks.sourceNoteId })
		.from(noteLinks)
		.where(eq(noteLinks.targetNoteId, noteId))
		.all();

	if (linkRows.length === 0) return [];

	const sourceIds = linkRows.map((r) => r.sourceNoteId);
	const accessibleIds = sourceIds.filter((id) => canAccessNote(db, id, userId).canAccess);
	if (accessibleIds.length === 0) return [];

	const sourceNotes = db
		.select({ id: notes.id, title: notes.title })
		.from(notes)
		.where(inArray(notes.id, accessibleIds))
		.all();

	return sourceNotes;
}
