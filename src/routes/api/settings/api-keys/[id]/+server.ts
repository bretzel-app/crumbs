import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { deleteApiKey } from '$lib/server/api-keys.js';
import { getUserId } from '$lib/server/api-utils.js';

export const DELETE: RequestHandler = async ({ params, ...event }) => {
	const userId = getUserId(event);
	const deleted = deleteApiKey(params.id, userId);
	if (!deleted) throw error(404, 'API key not found');
	return json({ success: true });
};
