import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { verifyPassword, createSession } from '$lib/server/auth.js';
import { checkRateLimit, recordLoginAttempt } from '$lib/server/rate-limit.js';
import { db } from '$lib/server/db/index.js';

export const POST: RequestHandler = async ({ request, cookies, getClientAddress }) => {
	const ip = getClientAddress();
	const { email, password } = await request.json();

	if (!email || !password) {
		throw error(400, 'Email and password are required');
	}

	const rateCheck = checkRateLimit(db, ip, email);
	if (!rateCheck.allowed) {
		return json(
			{ error: 'Too many login attempts. Please try again later.', retryAfter: rateCheck.retryAfter },
			{ status: 429, headers: { 'Retry-After': String(rateCheck.retryAfter) } }
		);
	}

	const user = await verifyPassword(email, password);
	if (!user) {
		recordLoginAttempt(db, ip, email, false);
		throw error(401, 'Invalid email or password');
	}

	recordLoginAttempt(db, ip, email, true);

	const userAgent = request.headers.get('user-agent') || undefined;
	const token = await createSession(user.id, { userAgent, ip });
	cookies.set('session', token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 30 * 24 * 60 * 60 // 30 days
	});

	return json({ success: true });
};
