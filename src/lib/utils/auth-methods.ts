import type { User } from '$lib/types/index.js';

/**
 * Human-readable reason a password reset is unavailable, keyed by auth provider.
 * Anything absent from this map falls back to BLOCKED_REASON_FALLBACK, so the
 * blocked path can never be left unexplained.
 *
 * A Map, not an object literal: an object inherits Object.prototype, so a lookup
 * for 'toString' or '__proto__' would resolve to an inherited member instead of
 * missing, and the fallback below would never fire. A Map has no such keys, so
 * totality holds by construction rather than by a guard that could be dropped.
 */
const BLOCKED_REASONS = new Map<string, string>([
	['none', 'This account has no password — it signs in via OAuth.'],
	['google', 'Managed by Google — password login is disabled for this account.'],
	['github', 'Managed by GitHub — password login is disabled for this account.'],
	['oidc', 'Managed by SSO — password login is disabled for this account.']
]);

const BLOCKED_REASON_FALLBACK = 'Password login is not available for this account.';

/**
 * Whether an admin may set a new password for this account.
 *
 * Password login is gated on `authProvider` — verifyPassword() only matches rows
 * where it equals 'password' — so writing a hash for any other provider stores a
 * credential that can never be used to sign in.
 */
export function canResetPassword(user: Pick<User, 'authProvider'>): boolean {
	return user.authProvider === 'password';
}

/**
 * Why a password reset is blocked, or null when it is allowed.
 *
 * `authProvider` is typed `string`, so the compiler cannot enforce exhaustiveness
 * here. The fallback guarantees the invariant this module exists for: whenever
 * `canResetPassword` is false, this returns a non-empty explanation, so the UI
 * never shows a disabled control without saying why.
 */
export function passwordResetBlockedReason(user: Pick<User, 'authProvider'>): string | null {
	if (canResetPassword(user)) return null;
	return BLOCKED_REASONS.get(user.authProvider) ?? BLOCKED_REASON_FALLBACK;
}
