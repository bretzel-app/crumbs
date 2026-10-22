import type { Db } from './db/index.js';
import { noteTags, tags } from './db/schema.js';
import { eq, and, inArray, isNotNull } from 'drizzle-orm';
import type { NoteColor } from '$lib/types/index.js';

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

/**
 * The user's tag colours as a map of tag name → colour. Tags without a colour are left out.
 */
export function getTagColors(db: Db, userId: number): Record<string, NoteColor> {
	const rows = db
		.select({ name: tags.name, color: tags.color })
		.from(tags)
		.where(and(eq(tags.userId, userId), isNotNull(tags.color)))
		.all();
	return Object.fromEntries(rows.map((row) => [row.name, row.color as NoteColor]));
}

/**
 * Set or clear (null or 'default') the colour of one of the user's tags. Creates the tag
 * row if no note uses it yet, so the colour applies as soon as a note mentions the tag.
 */
export function setTagColor(db: Db, userId: number, name: string, color: NoteColor | null) {
	const stored = color === 'default' ? null : color;
	db.insert(tags)
		.values({ name, userId, color: stored })
		.onConflictDoUpdate({ target: [tags.name, tags.userId], set: { color: stored } })
		.run();
}
