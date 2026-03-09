import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { searchNotes } from '$lib/server/notes-service.js';

export const GET: RequestHandler = async ({ url, ...event }) => {
	const userId = getUserId(event);
	const query = url.searchParams.get('q')?.trim();

	if (!query) {
		return json([]);
	}

	const results = searchNotes(userId, query);
	return json(results);
};
