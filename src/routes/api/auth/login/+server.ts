import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { verifyPassword, createSession } from '$lib/server/auth.js';

export const POST: RequestHandler = async ({ request, cookies }) => {
	const { email, password } = await request.json();

	if (!email || !password) {
		throw error(400, 'Email and password are required');
	}

	const user = await verifyPassword(email, password);
	if (!user) {
		throw error(401, 'Invalid email or password');
	}

	const token = await createSession(user.id);
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});

	return json({ success: true });
};
