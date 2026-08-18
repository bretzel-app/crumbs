import { describe, it, expect } from 'vitest';
import { verifiedEmailFromClaims, verifiedGithubEmail } from './verified-email.js';

describe('verifiedEmailFromClaims', () => {
	it('accepts an email the provider states is verified', () => {
		expect(verifiedEmailFromClaims({ email: 'a@x.com', email_verified: true })).toBe('a@x.com');
	});

	it('rejects an email the provider states is unverified', () => {
		expect(verifiedEmailFromClaims({ email: 'a@x.com', email_verified: false })).toBeNull();
	});

	it('rejects when the claim is absent, rather than assuming verified', () => {
		// An absent claim is not evidence of verification. Treating it as trusted is
		// what let an unverified address claim an existing account.
		expect(verifiedEmailFromClaims({ email: 'a@x.com' })).toBeNull();
	});

	it('rejects a truthy-but-not-true claim', () => {
		// Some providers serialise the claim as a string. Only boolean true counts.
		expect(verifiedEmailFromClaims({ email: 'a@x.com', email_verified: 'true' as never })).toBeNull();
	});

	it('rejects when there is no email at all', () => {
		expect(verifiedEmailFromClaims({ email_verified: true })).toBeNull();
		expect(verifiedEmailFromClaims({ email: '', email_verified: true })).toBeNull();
	});

	it('trims surrounding whitespace', () => {
		expect(verifiedEmailFromClaims({ email: '  a@x.com  ', email_verified: true })).toBe('a@x.com');
	});

	it('rejects an address that is only whitespace', () => {
		expect(verifiedEmailFromClaims({ email: '   ', email_verified: true })).toBeNull();
	});
});

describe('verifiedGithubEmail', () => {
	it('prefers the primary verified address', () => {
		expect(
			verifiedGithubEmail([
				{ email: 'other@x.com', primary: false, verified: true },
				{ email: 'primary@x.com', primary: true, verified: true }
			])
		).toBe('primary@x.com');
	});

	it('falls back to any verified address when the primary is unverified', () => {
		expect(
			verifiedGithubEmail([
				{ email: 'primary@x.com', primary: true, verified: false },
				{ email: 'other@x.com', primary: false, verified: true }
			])
		).toBe('other@x.com');
	});

	it('rejects an unverified primary rather than trusting it', () => {
		expect(verifiedGithubEmail([{ email: 'primary@x.com', primary: true, verified: false }])).toBeNull();
	});

	it('returns null for an empty list', () => {
		expect(verifiedGithubEmail([])).toBeNull();
	});

	it('ignores entries with a blank address', () => {
		expect(
			verifiedGithubEmail([
				{ email: '   ', primary: true, verified: true },
				{ email: 'real@x.com', primary: false, verified: true }
			])
		).toBe('real@x.com');
	});

	it('trims the address it returns', () => {
		expect(verifiedGithubEmail([{ email: ' a@x.com ', primary: true, verified: true }])).toBe('a@x.com');
	});
});
