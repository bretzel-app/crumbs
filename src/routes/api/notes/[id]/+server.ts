import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId, requireNoteAccess, requireNoteOwnership } from '$lib/server/api-utils.js';
import { getNote, updateNote, deleteNote } from '$lib/server/notes-service.js';

export const GET: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	const note = getNote(db, userId, params.id);
	if (!note) throw error(404, 'Note not found');

	return json(note);
};

export const PATCH: RequestHandler = async ({ params, request, ...event }) => {
	const userId = getUserId(event);
	const body = await request.json();
	const updated = updateNote(db, userId, params.id, body);
	if (!updated) throw error(404, 'Note not found');

	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	requireNoteOwnership(db, params.id, userId);

	const deleted = deleteNote(db, userId, params.id);
	if (!deleted) throw error(404, 'Note not found');

	return json({ success: true });
};
