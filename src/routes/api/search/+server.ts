import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes, noteTags, tags } from '$lib/server/db/schema.js';
import { and, eq, like, or, inArray } from 'drizzle-orm';
import { fetchTagsForNotes } from '$lib/server/tags.js';
import { getUserId } from '$lib/server/api-utils.js';

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const query = url.searchParams.get('q')?.trim();

	if (!query) {
		return json([]);
	}

	const pattern = `%${query}%`;

	const results = db
		.select()
		.from(notes)
		.where(
			and(
				eq(notes.userId, userId),
				eq(notes.trashed, false),
				or(like(notes.title, pattern), like(notes.content, pattern))
			)
		)
		.all();

	// Also search by tag name
	const tagResults = db
		.select({ noteId: noteTags.noteId })
		.from(noteTags)
		.innerJoin(tags, eq(noteTags.tagId, tags.id))
		.where(and(like(tags.name, pattern), eq(tags.userId, userId)))
		.all();

	const resultIds = new Set(results.map((n) => n.id));
	const extraNoteIds = [...new Set(tagResults.map((r) => r.noteId))].filter(
		(id) => !resultIds.has(id)
	);

	let extraNotes: typeof results = [];
	if (extraNoteIds.length > 0) {
		extraNotes = db
			.select()
			.from(notes)
			.where(and(eq(notes.userId, userId), inArray(notes.id, extraNoteIds), eq(notes.trashed, false)))
			.all();
	}

	const combined = [...results, ...extraNotes];
	const tagMap = fetchTagsForNotes(combined.map((n) => n.id));
	const withTags = combined.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? []
	}));

	return json(withTags);
};
