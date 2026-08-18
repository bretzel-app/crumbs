import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { canResetPassword, passwordResetBlockedReason } from './auth-methods.js';

const NON_PASSWORD_PROVIDERS = ['none', 'google', 'github', 'oidc'];

describe('canResetPassword', () => {
	it('allows a reset for a password account', () => {
		expect(canResetPassword({ authProvider: 'password' })).toBe(true);
	});

	it('blocks a reset for every non-password provider', () => {
		// verifyPassword() filters on authProvider === 'password', so a hash
		// written for any other provider could never be used to sign in.
		for (const authProvider of NON_PASSWORD_PROVIDERS) {
			expect(canResetPassword({ authProvider }), authProvider).toBe(false);
		}
	});

	it('blocks a reset for an unenumerated provider', () => {
		expect(canResetPassword({ authProvider: 'saml' })).toBe(false);
		expect(canResetPassword({ authProvider: '' })).toBe(false);
	});
});

describe('passwordResetBlockedReason', () => {
	it('returns null for a password account', () => {
		expect(passwordResetBlockedReason({ authProvider: 'password' })).toBeNull();
	});

	it('names the provider in the reason', () => {
		expect(passwordResetBlockedReason({ authProvider: 'none' })).toBe(
			'This account has no password — it signs in via OAuth.'
		);
		expect(passwordResetBlockedReason({ authProvider: 'google' })).toBe(
			'Managed by Google — password login is disabled for this account.'
		);
		expect(passwordResetBlockedReason({ authProvider: 'github' })).toBe(
			'Managed by GitHub — password login is disabled for this account.'
		);
		expect(passwordResetBlockedReason({ authProvider: 'oidc' })).toBe(
			'Managed by SSO — password login is disabled for this account.'
		);
	});

	it('falls back to a generic reason for an unenumerated provider', () => {
		expect(passwordResetBlockedReason({ authProvider: 'saml' })).toBe(
			'Password login is not available for this account.'
		);
	});

	it('always explains a blocked reset', () => {
		// authProvider is typed `string`, so no missing branch can be caught by
		// the compiler. A null reason here would render a disabled control with
		// no explanation — the confusion issue #77 reported.
		//
		// The Object.prototype keys are the interesting cases: with a plain object
		// literal as the lookup table they resolve to inherited members, so a
		// nullish fallback never fires and the function returns a function or an
		// object in place of its declared string. Asserting typeof rather than
		// truthiness is what catches that.
		const providers = [
			...NON_PASSWORD_PROVIDERS,
			'saml',
			'',
			'PASSWORD',
			'ldap',
			'unknown',
			'__proto__',
			'toString',
			'constructor',
			'hasOwnProperty',
			'valueOf'
		];
		for (const authProvider of providers) {
			const user = { authProvider };
			expect(canResetPassword(user), authProvider).toBe(false);
			const reason = passwordResetBlockedReason(user);
			expect(typeof reason, authProvider).toBe('string');
			expect(reason, authProvider).not.toBe('');
		}
	});
});

describe('auth-methods module', () => {
	it('does not use Math.random', () => {
		// The reset-eligibility rule must be pure and deterministic.
		const source = readFileSync(new URL('./auth-methods.ts', import.meta.url), 'utf8');
		expect(source).not.toContain('Math.random');
	});
});
