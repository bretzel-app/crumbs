import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { getUserId } from '$lib/server/api-utils.js';
import { verifyPassword, deleteUser, deleteSession, getUser } from '$lib/server/auth.js';
import { isEmailConfigured, sendAccountDeletedEmail } from '$lib/server/email.js';
import { requiresPasswordForAccountDeletion } from '$lib/utils/auth-methods.js';

export const DELETE: RequestHandler = async ({ request, cookies, ...event }) => {
	const userId = getUserId(event);
	const user = getUser(userId);
	if (!user) throw error(404, 'User not found');

	const body = await request.json();

	// Password required for pure password accounts; OAuth-linked accounts may delete
	// with their active SSO session even when password login was admin-enabled.
	if (requiresPasswordForAccountDeletion(user)) {
		if (!body.password) throw error(400, 'Password is required');
		const verified = await verifyPassword(user.email, body.password);
		if (!verified) throw error(401, 'Invalid password');
	}

	// Capture email/name before deletion
	const { email: userEmail, displayName: userName } = user;

	// Delete user and all associated data
	await deleteUser(userId);

	// Clear session cookie
	const token = cookies.get('session');
	if (token) {
		await deleteSession(token);
		cookies.delete('session', { path: '/' });
	}

	// Send deletion confirmation email (fire-and-forget)
	if (isEmailConfigured() && userEmail) {
		sendAccountDeletedEmail(userEmail, userName).catch(() => {});
	}

	return json({ success: true });
};
