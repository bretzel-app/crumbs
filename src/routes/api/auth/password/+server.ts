import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { changePassword } from '$lib/server/auth.js';

export const PUT: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const { currentPassword, newPassword } = await request.json();

	if (!currentPassword || !newPassword) {
		throw error(400, 'Current password and new password are required');
	}

	if (newPassword.length < 8) {
		throw error(400, 'New password must be at least 8 characters');
	}

	const success = await changePassword(userId, currentPassword, newPassword);
	if (!success) {
		throw error(401, 'Current password is incorrect');
	}

	return json({ success: true });
};
