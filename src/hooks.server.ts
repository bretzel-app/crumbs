import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { validateSession, isSetupComplete } from '$lib/server/auth.js';

const PUBLIC_PATHS = [
	'/login',
	'/setup',
	'/api/auth/login',
	'/api/auth/setup',
	'/api/auth/oauth'
];

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	// Initialize locals
	event.locals.user = null;

	// Allow public paths
	if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
		return resolve(event);
	}

	// Check if setup is complete
	const setupDone = await isSetupComplete();
	if (!setupDone) {
		if (pathname !== '/setup') {
			throw redirect(302, '/setup');
		}
		return resolve(event);
	}

	// Validate session and populate user
	const sessionToken = event.cookies.get('session');
	if (sessionToken) {
		const result = await validateSession(sessionToken);
		if (result.valid && result.user) {
			event.locals.user = result.user;
		}
	}

	if (!event.locals.user) {
		if (pathname.startsWith('/api/')) {
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'Content-Type': 'application/json' }
			});
		}
		throw redirect(302, '/login');
	}

	return resolve(event);
};
