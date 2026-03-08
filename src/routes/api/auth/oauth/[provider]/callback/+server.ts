import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { validateGoogleCallback } from '$lib/server/oauth/google.js';
import { validateGithubCallback } from '$lib/server/oauth/github.js';
import { validateOidcCallback } from '$lib/server/oauth/oidc.js';
import { findOrLinkOAuthUser, createSession } from '$lib/server/auth.js';

export const GET: RequestHandler = async ({ params, url, cookies, request, getClientAddress }) => {
	const { provider } = params;
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const storedState = cookies.get('oauth_state');

	if (!code || !state || !storedState || state !== storedState) {
		throw error(400, 'Invalid OAuth callback');
	}

	// Clean up OAuth cookies
	cookies.delete('oauth_state', { path: '/' });

	let profile: { email: string; name: string; providerId: string } | null = null;

	if (provider === 'google') {
		const codeVerifier = cookies.get('oauth_code_verifier');
		cookies.delete('oauth_code_verifier', { path: '/' });
		if (!codeVerifier) throw error(400, 'Missing code verifier');
		profile = await validateGoogleCallback(code, codeVerifier);
	} else if (provider === 'github') {
		profile = await validateGithubCallback(code);
	} else if (provider === 'oidc') {
		const codeVerifier = cookies.get('oauth_code_verifier');
		cookies.delete('oauth_code_verifier', { path: '/' });
		if (!codeVerifier) throw error(400, 'Missing code verifier');
		profile = await validateOidcCallback(code, codeVerifier);
	} else {
		throw error(404, 'Unknown provider');
	}

	if (!profile) {
		throw error(400, 'Failed to get profile from OAuth provider');
	}

	// Find or link user (invite-only)
	const user = findOrLinkOAuthUser(provider, profile.providerId, profile.email, profile.name);
	if (!user) {
		// User not found — not invited
		throw redirect(302, '/login?error=no_account');
	}

	// Create session
	const userAgent = request.headers.get('user-agent') || undefined;
	const ip = getClientAddress();
	const token = await createSession(user.id, { userAgent, ip });

	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});

	throw redirect(302, '/');
};
