import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { createGoogleAuthUrl } from '$lib/server/oauth/google.js';
import { createGithubAuthUrl } from '$lib/server/oauth/github.js';
import { createOidcAuthUrl } from '$lib/server/oauth/oidc.js';

export const GET: RequestHandler = async ({ params, cookies }) => {
	const { provider } = params;

	if (provider === 'google') {
		const result = createGoogleAuthUrl();
		if (!result) throw error(404, 'Google OAuth not configured');

		cookies.set('oauth_state', result.state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});
		cookies.set('oauth_code_verifier', result.codeVerifier, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});

		throw redirect(302, result.url.toString());
	}

	if (provider === 'github') {
		const result = createGithubAuthUrl();
		if (!result) throw error(404, 'GitHub OAuth not configured');

		cookies.set('oauth_state', result.state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});

		throw redirect(302, result.url.toString());
	}

	if (provider === 'oidc') {
		const result = await createOidcAuthUrl();
		if (!result) throw error(404, 'OIDC not configured');

		cookies.set('oauth_state', result.state, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});
		cookies.set('oauth_code_verifier', result.codeVerifier, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 600
		});

		throw redirect(302, result.url.toString());
	}

	throw error(404, 'Unknown provider');
};
