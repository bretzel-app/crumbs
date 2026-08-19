import type { User } from '$lib/types/index.js';

/**
 * Whether an admin may set a new password for this account.
 *
 * Password login is gated on `passwordLoginEnabled`, which resetPassword() sets
 * deliberately — so an admin can enable password auth on any account, including
 * OAuth-only ones, without clearing their SSO link.
 */
export function canResetPassword(_user: Pick<User, 'passwordLoginEnabled' | 'authProvider'>): boolean {
	return true;
}

/**
 * Why a password reset is blocked, or null when it is allowed.
 *
 * Eligibility is checked in the UI for the signed-in admin's own row; every
 * other account may receive a reset that enables password login.
 */
export function passwordResetBlockedReason(
	_user: Pick<User, 'passwordLoginEnabled' | 'authProvider'>
): string | null {
	return null;
}

/**
 * Whether self-service account deletion must verify the user's password.
 *
 * OAuth-linked accounts may delete with their active SSO session alone, even
 * when an admin has enabled password login. Pure password accounts, and
 * OAuth-only rows with password login enabled but no provider link, still
 * require the password.
 */
export function requiresPasswordForAccountDeletion(
	user: Pick<User, 'authProvider' | 'passwordLoginEnabled'>
): boolean {
	if (user.authProvider === 'password') return true;
	if (user.authProvider === 'none' && user.passwordLoginEnabled) return true;
	return false;
}

/** Whether an admin may turn off password login for this account. */
export function canDisablePasswordLogin(
	user: Pick<User, 'id' | 'passwordLoginEnabled' | 'authProvider'>,
	adminId: number
): boolean {
	if (user.id === adminId || !user.passwordLoginEnabled) return false;
	// Only when another sign-in method exists — disabling on a password-only row
	// would lock the user out with no OAuth fallback.
	return user.authProvider !== 'password' && user.authProvider !== 'none';
}
