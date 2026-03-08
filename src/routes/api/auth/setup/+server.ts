import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { setupUser, createSession, isSetupComplete } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const alreadySetup = await isSetupComplete();
	if (alreadySetup) {
		throw error(400, 'Setup already completed');
	}

	const { email, displayName, password } = await request.json();

	if (!email) {
		throw error(400, 'Email is required');
	}

	if (!password || password.length < 8) {
		throw error(400, 'Password must be at least 8 characters');
	}

	const user = await setupUser(email, password, displayName);
	if (!user) {
		throw error(500, 'Failed to create user');
	}

	const userAgent = request.headers.get('user-agent') || undefined;
	const ip = getClientAddress();
	const token = await createSession(user.id, { userAgent, ip });
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60
	});

	return json({ success: true }, { status: 201 });
};
