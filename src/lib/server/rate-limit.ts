import type { Db } from './db/index.js';
import { loginAttempts } from './db/schema.js';
import { and, eq, gte, lt, sql } from 'drizzle-orm';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export function checkRateLimit(
	db: Db,
	ip: string,
	email: string,
	now?: Date
): { allowed: boolean; retryAfter?: number } {
	const currentTime = now ?? new Date();
	const windowStart = new Date(currentTime.getTime() - LOCKOUT_MS);

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
				(latest.timestamp.getTime() + LOCKOUT_MS - currentTime.getTime()) / 1000
			);
			return { allowed: false, retryAfter: Math.max(retryAfter, 1) };
		}
		return { allowed: false, retryAfter: 900 };
	}

	return { allowed: true };
}

export function recordLoginAttempt(db: Db, ip: string, email: string, success: boolean, now?: Date): void {
	db.insert(loginAttempts)
		.values({
			ip,
			email,
			success,
			timestamp: now ?? new Date()
		})
		.run();
}

export function clearOldAttempts(db: Db, now?: Date): void {
	const cutoff = new Date((now ?? new Date()).getTime() - LOCKOUT_MS * 2);
	db.delete(loginAttempts)
		.where(lt(loginAttempts.timestamp, cutoff))
		.run();
}
