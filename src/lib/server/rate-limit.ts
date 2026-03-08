import { db } from './db/index.js';
import { loginAttempts } from './db/schema.js';
import { and, eq, gte, sql } from 'drizzle-orm';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(
	ip: string,
	email: string
): { allowed: boolean; retryAfter?: number } {
	// Skip rate limiting in test environment
	if (process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT_TEST === '1') {
		return { allowed: true };
	}

	const windowStart = new Date(Date.now() - LOCKOUT_MS);

	// Count failed attempts from this IP in the lockout window
	const result = db
		.select({ count: sql<number>`count(*)` })
		.from(loginAttempts)
		.where(
			and(
				eq(loginAttempts.ip, ip),
				eq(loginAttempts.success, false),
				gte(loginAttempts.timestamp, windowStart)
			)
		)
		.get();

	const failedCount = result?.count ?? 0;

	if (failedCount >= MAX_ATTEMPTS) {
		// Find the most recent failed attempt to calculate retry-after
		const latest = db
			.select({ timestamp: loginAttempts.timestamp })
			.from(loginAttempts)
			.where(
				and(
					eq(loginAttempts.ip, ip),
					eq(loginAttempts.success, false),
					gte(loginAttempts.timestamp, windowStart)
				)
			)
			.orderBy(sql`${loginAttempts.timestamp} DESC`)
			.limit(1)
			.get();

		if (latest) {
			const retryAfter = Math.ceil(
				(latest.timestamp.getTime() + LOCKOUT_MS - Date.now()) / 1000
			);
			return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
		}
		return { allowed: false, retryAfter: 900 };
	}

	return { allowed: true };
}

export function recordLoginAttempt(ip: string, email: string, success: boolean): void {
	db.insert(loginAttempts)
		.values({
			ip,
			email,
			success,
			timestamp: new Date()
		})
		.run();
}

export function clearOldAttempts(): void {
	const cutoff = new Date(Date.now() - LOCKOUT_MS * 2);
	db.delete(loginAttempts)
		.where(sql`${loginAttempts.timestamp} < ${cutoff}`)
		.run();
}
