import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { requireAdmin } from '$lib/server/api-utils.js';
import { getUser, deleteUser, updateUserRole, resetPassword, revokeAllSessions } from '$lib/server/auth.js';
import { isEmailConfigured, sendPasswordResetEmail, sendRoleChangedEmail } from '$lib/server/email.js';
import { canResetPassword, passwordResetBlockedReason } from '$lib/utils/auth-methods.js';

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
		// Refuse accounts that do not sign in with a password. resetPassword()
		// writes only passwordHash, and verifyPassword() matches only rows whose
		// authProvider is 'password' — a hash written here could never be used to
		// sign in, while the email below would claim the reset worked. The reason
		// text comes from the same module as the check, so this matches what the
		// UI explains; the ?? only satisfies error()'s string parameter.
		if (!canResetPassword(user)) {
			throw error(400, passwordResetBlockedReason(user) ?? 'This account does not use password login');
		}
		await resetPassword(userId, body.newPassword);

		// Notify user of password reset (fire-and-forget)
		if (isEmailConfigured() && user.email) {
			sendPasswordResetEmail(user.email, user.displayName, origin).catch(() => {});
		}
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
