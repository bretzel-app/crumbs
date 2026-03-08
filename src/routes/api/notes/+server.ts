import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { extractTags } from '$lib/utils/tags.js';
import { fetchTagsForNotes, syncNoteTags } from '$lib/server/tags.js';
import { fetchAttachmentsForNotes } from '$lib/server/attachments.js';
import { getUserId } from '$lib/server/api-utils.js';

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const filter = url.searchParams.get('filter') || 'all';

	let conditions;
	switch (filter) {
		case 'archived':
			conditions = and(eq(notes.userId, userId), eq(notes.archived, true), eq(notes.trashed, false));
			break;
		case 'trashed':
			conditions = and(eq(notes.userId, userId), eq(notes.trashed, true));
			break;
		default:
			conditions = and(eq(notes.userId, userId), eq(notes.archived, false), eq(notes.trashed, false));
	}

	const result = db
		.select()
		.from(notes)
		.where(conditions)
		.orderBy(desc(notes.pinned), desc(notes.updatedAt))
		.all();

	const noteIds = result.map((n) => n.id);
	const tagMap = fetchTagsForNotes(noteIds);
	const attachmentMap = fetchAttachmentsForNotes(noteIds);
	const notesWithTags = result.map((note) => ({
		...note,
		tags: tagMap.get(note.id) ?? [],
		attachments: attachmentMap.get(note.id) ?? []
	}));

	return json(notesWithTags);
};

export const POST: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const body = await request.json();
	const now = new Date();
	const id = body.id || uuidv4();

	const newNote = {
		id,
		userId,
		title: body.title || '',
		content: body.content || '',
		color: body.color || 'default',
		pinned: body.pinned || false,
		archived: false,
		trashed: false,
		trashedAt: null,
		checklistMode: body.checklistMode || false,
		sortOrder: body.sortOrder || 0,
		createdAt: now,
		updatedAt: now,
		version: 1
	};

	const content = `${newNote.title} ${newNote.content}`;
	const extractedTags = extractTags(content);

	db.transaction((tx) => {
		tx.insert(notes).values(newNote).run();
	});
	syncNoteTags(id, extractedTags);

	return json({ ...newNote, tags: extractedTags }, { status: 201 });
};
