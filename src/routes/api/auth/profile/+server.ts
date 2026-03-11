import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { updateUserProfile, getUser } from '$lib/server/auth.js';
import { isEmailConfigured, sendEmailChangedEmail } from '$lib/server/email.js';

export const PUT: RequestHandler = async ({ request, ...event }) => {
	const userId = getUserId(event);
	const { displayName, email } = await request.json();

	if (email !== undefined && !email) {
		throw error(400, 'Email cannot be empty');
	}

	// Capture old email before update to notify on change
	const existingUser = email !== undefined ? getUser(userId) : null;

	updateUserProfile(userId, { displayName, email });

	// Send notification to old email when email address changes
	if (isEmailConfigured() && existingUser?.email && email && existingUser.email !== email) {
		sendEmailChangedEmail(existingUser.email, existingUser.displayName, email).catch(() => {});
	}

	return json({ success: true });
};
