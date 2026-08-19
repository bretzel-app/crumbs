import { describe, it, expect } from 'vitest';
import {
	canResetPassword,
	passwordResetBlockedReason,
	requiresPasswordForAccountDeletion,
	canDisablePasswordLogin
} from './auth-methods.js';

describe('canResetPassword', () => {
	it('allows a reset for a password account', () => {
		expect(canResetPassword({ authProvider: 'password', passwordLoginEnabled: true })).toBe(true);
	});

	it('allows a reset for an OAuth-only account', () => {
		expect(canResetPassword({ authProvider: 'none', passwordLoginEnabled: false })).toBe(true);
	});

	it('allows a reset for an OAuth-linked account', () => {
		expect(canResetPassword({ authProvider: 'google', passwordLoginEnabled: true })).toBe(true);
	});
});

describe('passwordResetBlockedReason', () => {
	it('returns null for every account type', () => {
		for (const user of [
			{ authProvider: 'password', passwordLoginEnabled: true },
			{ authProvider: 'none', passwordLoginEnabled: false },
			{ authProvider: 'google', passwordLoginEnabled: true },
			{ authProvider: 'oidc', passwordLoginEnabled: false }
		]) {
			expect(passwordResetBlockedReason(user)).toBeNull();
		}
	});
});

describe('requiresPasswordForAccountDeletion', () => {
	it('requires password for a pure password account', () => {
		expect(
			requiresPasswordForAccountDeletion({ authProvider: 'password', passwordLoginEnabled: true })
		).toBe(true);
	});

	it('requires password for OAuth-only with admin-enabled password login', () => {
		expect(
			requiresPasswordForAccountDeletion({ authProvider: 'none', passwordLoginEnabled: true })
		).toBe(true);
	});

	it('does not require password for OAuth-linked accounts even when password login is enabled', () => {
		for (const authProvider of ['google', 'github', 'oidc']) {
			expect(
				requiresPasswordForAccountDeletion({ authProvider, passwordLoginEnabled: true }),
				authProvider
			).toBe(false);
		}
	});

	it('does not require password for OAuth-only without password login', () => {
		expect(
			requiresPasswordForAccountDeletion({ authProvider: 'none', passwordLoginEnabled: false })
		).toBe(false);
	});
});

describe('canDisablePasswordLogin', () => {
	it('allows disabling for an OAuth-linked user with password login enabled', () => {
		expect(
			canDisablePasswordLogin({ id: 2, passwordLoginEnabled: true, authProvider: 'google' }, 1)
		).toBe(true);
	});

	it('blocks disabling on the admin own row', () => {
		expect(
			canDisablePasswordLogin({ id: 1, passwordLoginEnabled: true, authProvider: 'google' }, 1)
		).toBe(false);
	});

	it('blocks disabling when password login is already off', () => {
		expect(
			canDisablePasswordLogin({ id: 2, passwordLoginEnabled: false, authProvider: 'google' }, 1)
		).toBe(false);
	});

	it('blocks disabling on a password-only account', () => {
		expect(
			canDisablePasswordLogin({ id: 2, passwordLoginEnabled: true, authProvider: 'password' }, 1)
		).toBe(false);
	});

	it('blocks disabling on OAuth-only with admin-enabled password but no provider link', () => {
		expect(
			canDisablePasswordLogin({ id: 2, passwordLoginEnabled: true, authProvider: 'none' }, 1)
		).toBe(false);
	});
});
