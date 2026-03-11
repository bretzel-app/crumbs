import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types.js';
import { verifyPassword, createSession } from '$lib/server/auth.js';
import { checkRateLimit, recordLoginAttempt } from '$lib/server/rate-limit.js';
import { db } from '$lib/server/db/index.js';
import { users } from '$lib/server/db/schema.js';
import { eq } from 'drizzle-orm';
import { isEmailConfigured, sendAccountLockedEmail } from '$lib/server/email.js';

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

		// Check if this failure just triggered a lockout — if so, notify the user
		if (isEmailConfigured()) {
			const newCheck = checkRateLimit(db, ip, email);
			if (!newCheck.allowed) {
				const retryAfterMinutes = Math.ceil((newCheck.retryAfter ?? 900) / 60);
				const accountUser = db
					.select({ email: users.email, displayName: users.displayName })
					.from(users)
					.where(eq(users.email, email))
					.get();
				if (accountUser?.email) {
					sendAccountLockedEmail(
						accountUser.email,
						accountUser.displayName,
						retryAfterMinutes
					).catch(() => {});
				}
			}
		}

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
