import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId, requireNoteAccess, requireNoteOwnership } from '$lib/server/api-utils.js';
import { getNote, updateNote, deleteNote } from '$lib/server/notes-service.js';
import { fetchCollaboratorsForNotes } from '$lib/server/collaborators.js';
import { isEmailConfigured, sendNotePermanentlyDeletedEmail } from '$lib/server/email.js';
import { getPreferences } from '$lib/server/preferences.js';

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

	// Fetch note and collaborators before deletion to send notifications
	let collaboratorsToNotify: Array<{ email: string; displayName: string }> = [];
	let noteTitle = 'Untitled';

	if (isEmailConfigured()) {
		const note = getNote(db, userId, params.id);
		if (note) {
			noteTitle = note.title || 'Untitled';
			const collabMap = fetchCollaboratorsForNotes(db, [params.id]);
			const collaborators = collabMap.get(params.id) ?? [];
			for (const collab of collaborators) {
				const prefs = getPreferences(db, collab.userId);
				if (prefs.notifyOnNoteDeleted !== 'false' && collab.email) {
					collaboratorsToNotify.push({ email: collab.email, displayName: collab.displayName });
				}
			}
		}
	}

	const deleted = deleteNote(db, userId, params.id);
	if (!deleted) throw error(404, 'Note not found');

	// Notify collaborators about the deleted note (fire-and-forget)
	for (const collab of collaboratorsToNotify) {
		sendNotePermanentlyDeletedEmail(collab.email, collab.displayName, noteTitle).catch(() => {});
	}

	return json({ success: true });
};
