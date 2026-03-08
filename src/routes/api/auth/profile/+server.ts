import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { updateUserProfile } from '$lib/server/auth.js';

export const PUT: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const { displayName, email } = await request.json();

	if (email !== undefined && !email) {
		throw error(400, 'Email cannot be empty');
	}

	updateUserProfile(userId, { displayName, email });
	return json({ success: true });
};
