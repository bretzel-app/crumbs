import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/api-utils.js';
import { getUser, deleteUser, updateUserRole, resetPassword, revokeAllSessions, disablePasswordLogin } from '$lib/server/auth.js';
import { isEmailConfigured, sendPasswordResetEmail, sendRoleChangedEmail } from '$lib/server/email.js';

export const PATCH: RequestHandler = async ({ params, request, ...event }) => {
	const admin = requireAdmin(event);
	const userId = parseInt(params.id, 10);
	const body = await request.json();

	const user = getUser(userId);
	if (!user) throw error(404, 'User not found');

	const origin = process.env.ORIGIN || 'http://localhost:3000';

	if (body.role !== undefined) {
		if (body.role !== 'admin' && body.role !== 'user') {
			throw error(400, 'Invalid role');
		}
		// Prevent admin from demoting themselves
		if (userId === admin.id && body.role !== 'admin') {
			throw error(400, 'Cannot change your own role');
		}
		updateUserRole(userId, body.role);

		// Notify user of role change (fire-and-forget)
		if (isEmailConfigured() && user.email) {
			sendRoleChangedEmail(user.email, user.displayName, body.role, origin).catch(() => {});
		}
	}

	if (body.newPassword !== undefined) {
		if (body.newPassword.length < 8) {
			throw error(400, 'Password must be at least 8 characters');
		}
		// Prevent admin from resetting their own password — changing your own
		// password goes through the profile flow, which verifies the current one.
		if (userId === admin.id) {
			throw error(400, 'Cannot reset your own password — change it from your profile instead');
		}
		await resetPassword(userId, body.newPassword);
		revokeAllSessions(userId);

		// Notify user of password reset (fire-and-forget)
		if (isEmailConfigured() && user.email) {
			sendPasswordResetEmail(user.email, user.displayName, origin).catch(() => {});
		}
	}

	if (body.disablePasswordLogin) {
		if (userId === admin.id) {
			throw error(400, 'Cannot disable password login on your own account');
		}
		if (!user.passwordLoginEnabled) {
			throw error(400, 'Password login is not enabled for this account');
		}
		if (user.authProvider === 'password' || user.authProvider === 'none') {
			throw error(
				400,
				'Password login can only be disabled when the account is linked to OAuth'
			);
		}
		disablePasswordLogin(userId);
	}

	if (body.revokeSessions) {
		revokeAllSessions(userId);
	}

	const updated = getUser(userId);
	return json(updated);
};

export const DELETE: RequestHandler = async ({ params, ...event }) => {
	const admin = requireAdmin(event);
	const userId = parseInt(params.id, 10);

	if (userId === admin.id) {
		throw error(400, 'Cannot delete your own account');
	}

	const user = getUser(userId);
	if (!user) throw error(404, 'User not found');

	await deleteUser(userId);
	return json({ success: true });
};
