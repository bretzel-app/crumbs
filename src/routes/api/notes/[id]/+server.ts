import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { notes } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { extractTags } from '$lib/utils/tags.js';
import { fetchTagsForNotes, syncNoteTags } from '$lib/server/tags.js';
import { fetchAttachmentsForNotes } from '$lib/server/attachments.js';

export const GET: RequestHandler = async ({ params }) => {
	const note = db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!note) {
		throw error(404, 'Note not found');
	}

	const tagMap = fetchTagsForNotes([note.id]);
	const attachmentMap = fetchAttachmentsForNotes([note.id]);

	return json({
		...note,
		tags: tagMap.get(note.id) ?? [],
		attachments: attachmentMap.get(note.id) ?? []
	});
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const body = await request.json();
	const existing = db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!existing) {
		throw error(404, 'Note not found');
	}

	const now = new Date();
	const updates: Record<string, unknown> = {
		updatedAt: now,
		version: existing.version + 1
	};

	if (body.title !== undefined) updates.title = body.title;
	if (body.content !== undefined) updates.content = body.content;
	if (body.color !== undefined) updates.color = body.color;
	if (body.pinned !== undefined) updates.pinned = body.pinned;
	if (body.archived !== undefined) updates.archived = body.archived;
	if (body.trashed !== undefined) {
		updates.trashed = body.trashed;
		updates.trashedAt = body.trashed ? now : null;
	}
	if (body.checklistMode !== undefined) updates.checklistMode = body.checklistMode;
	if (body.sortOrder !== undefined) updates.sortOrder = body.sortOrder;

	db.update(notes).set(updates).where(eq(notes.id, params.id)).run();

	const updated = db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (body.title !== undefined || body.content !== undefined) {
		const content = `${updated!.title} ${updated!.content}`;
		const extractedTags = extractTags(content);
		syncNoteTags(params.id, extractedTags);
	}

	const tagMap = fetchTagsForNotes([params.id]);
	const attachmentMap = fetchAttachmentsForNotes([params.id]);

	return json({
		...updated,
		tags: tagMap.get(params.id) ?? [],
		attachments: attachmentMap.get(params.id) ?? []
	});
};

export const DELETE: RequestHandler = async ({ params }) => {
	const existing = db.select().from(notes).where(eq(notes.id, params.id)).get();

	if (!existing) {
		throw error(404, 'Note not found');
	}

	db.delete(notes).where(eq(notes.id, params.id)).run();
	return json({ success: true });
};
