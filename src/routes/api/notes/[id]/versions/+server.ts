import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { db } from '$lib/server/db/index.js';
import { getUserId, requireNoteAccess } from '$lib/server/api-utils.js';
import { listVersions } from '$lib/server/versions-service.js';

export const GET: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	requireNoteAccess(db, params.id, userId);

	const versions = listVersions(db, params.id);
	return json(versions);
};
