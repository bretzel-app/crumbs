import * as arctic from 'arctic';
import { getGoogleClient } from './providers.js';

export function createGoogleAuthUrl(): { url: URL; state: string; codeVerifier: string } | null {
	const google = getGoogleClient();
	if (!google) return null;

	const state = arctic.generateState();
	const codeVerifier = arctic.generateCodeVerifier();
	const scopes = ['openid', 'profile', 'email'];
	const url = google.createAuthorizationURL(state, codeVerifier, scopes);

	return { url, state, codeVerifier };
}

export async function validateGoogleCallback(
	code: string,
	codeVerifier: string
): Promise<{ email: string; name: string; providerId: string } | null> {
	const google = getGoogleClient();
	if (!google) return null;

	const tokens = await google.validateAuthorizationCode(code, codeVerifier);
	const idToken = tokens.idToken();
	const claims = arctic.decodeIdToken(idToken) as {
		sub: string;
		email?: string;
		name?: string;
	};

	if (!claims.email) return null;

	return {
		email: claims.email,
		name: claims.name || claims.email.split('@')[0],
		providerId: claims.sub
	};
}
