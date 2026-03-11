import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId, requireNoteAccess } from '$lib/server/api-utils.js';
import { getVersion, snapshotCurrentNote } from '$lib/server/versions-service.js';
import { updateNote } from '$lib/server/notes-service.js';

export const POST: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const version = getVersion(db, params.id, params.versionId);
	if (!version) throw error(404, 'Version not found');

	// Snapshot current state before overwriting so the user can undo the restore
	snapshotCurrentNote(db, params.id);

	// Apply the restored content (updateNote will increment version + create a new snapshot)
	const restored = updateNote(db, userId, params.id, {
		title: version.title,
		content: version.content,
		checklistMode: version.checklistMode,
		color: version.color
	});

	if (!restored) throw error(404, 'Note not found');

	return json(restored);
};
