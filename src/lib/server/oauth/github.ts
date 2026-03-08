import * as arctic from 'arctic';
import { getGithubClient } from './providers.js';

export function createGithubAuthUrl(): { url: URL; state: string } | null {
	const github = getGithubClient();
	if (!github) return null;

	const state = arctic.generateState();
	const scopes = ['user:email'];
	const url = github.createAuthorizationURL(state, scopes);

	return { url, state };
}

export async function validateGithubCallback(
	code: string
): Promise<{ email: string; name: string; providerId: string } | null> {
	const github = getGithubClient();
	if (!github) return null;

	const tokens = await github.validateAuthorizationCode(code);
	const accessToken = tokens.accessToken();

	// Fetch user profile
	const userRes = await fetch('https://api.github.com/user', {
		headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
	});
	if (!userRes.ok) return null;
	const user = (await userRes.json()) as { id: number; login: string; name?: string; email?: string };

	// GitHub may not return email in profile — fetch from emails endpoint
	let email = user.email;
	if (!email) {
		const emailsRes = await fetch('https://api.github.com/user/emails', {
			headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' }
		});
		if (emailsRes.ok) {
			const emails = (await emailsRes.json()) as { email: string; primary: boolean; verified: boolean }[];
			const primary = emails.find((e) => e.primary && e.verified);
			email = primary?.email || emails.find((e) => e.verified)?.email || undefined;
		}
	}

	if (!email) return null;

	return {
		email,
		name: user.name || user.login,
		providerId: String(user.id)
	};
}
