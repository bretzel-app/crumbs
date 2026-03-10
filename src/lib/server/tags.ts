import type { Db } from './db/index.js';
import { noteTags, tags } from './db/schema.js';
import { eq, and, inArray } from 'drizzle-orm';

/**
 * Batch fetch tags for multiple notes in a single query.
 * Returns a Map of noteId → tag names.
 */
export function fetchTagsForNotes(db: Db, noteIds: string[]): Map<string, string[]> {
	if (noteIds.length === 0) return new Map();

	const rows = db
		.select({ noteId: noteTags.noteId, name: tags.name })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(inArray(noteTags.noteId, noteIds))
		.all();

	const map = new Map<string, string[]>();
	for (const row of rows) {
		const existing = map.get(row.noteId);
		if (existing) {
			existing.push(row.name);
		} else {
			map.set(row.noteId, [row.name]);
		}
	}
	return map;
}

/**
 * Sync tags for a note: removes old associations, upserts tags, creates new associations.
 * Should be called within a transaction for atomicity.
 */
export function syncNoteTags(db: Db, noteId: string, tagNames: string[], userId: number) {
	db.delete(noteTags).where(eq(noteTags.noteId, noteId)).run();

	for (const name of tagNames) {
		let tagRow = db
			.select()
			.from(tags)
			.where(and(eq(tags.name, name), eq(tags.userId, userId)))
			.get();
		if (!tagRow) {
			const result = db.insert(tags).values({ name, userId }).returning().all();
			tagRow = result[0];
		}
		db.insert(noteTags).values({ noteId, tagId: tagRow.id }).run();
	}
}
