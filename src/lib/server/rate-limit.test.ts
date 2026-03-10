import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { loginAttempts } from './db/schema.js';
import type { Db } from './db/index.js';
import { checkRateLimit, recordLoginAttempt, clearOldAttempts } from './rate-limit.js';

let db: Db;

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
});

const IP = '192.168.1.1';
const EMAIL = 'test@test.com';

function addFailedAttempts(count: number, now: Date) {
	for (let i = 0; i < count; i++) {
		recordLoginAttempt(db, IP, EMAIL, false, now);
	}
}

describe('checkRateLimit', () => {
	it('should allow first attempt', () => {
		const result = checkRateLimit(db, IP, EMAIL);
		expect(result.allowed).toBe(true);
	});

	it('should allow up to 4 failed attempts', () => {
		const now = new Date();
		addFailedAttempts(4, now);
		const result = checkRateLimit(db, IP, EMAIL, now);
		expect(result.allowed).toBe(true);
	});

	it('should block after 5 failed attempts within window', () => {
		const now = new Date();
		addFailedAttempts(5, now);
		const result = checkRateLimit(db, IP, EMAIL, now);
		expect(result.allowed).toBe(false);
		expect(result.retryAfter).toBeDefined();
		expect(result.retryAfter!).toBeGreaterThan(0);
	});

	it('should return correct retryAfter value', () => {
		const now = new Date();
		addFailedAttempts(5, now);
		const result = checkRateLimit(db, IP, EMAIL, now);
		// Lockout is 15 minutes (900 seconds)
		expect(result.retryAfter).toBe(900);
	});

	it('should allow again after lockout expires', () => {
		const attemptTime = new Date('2024-01-01T00:00:00Z');
		addFailedAttempts(5, attemptTime);

		// Check at attempt time — should be blocked
		const blocked = checkRateLimit(db, IP, EMAIL, attemptTime);
		expect(blocked.allowed).toBe(false);

		// Check 16 minutes later — should be allowed
		const later = new Date(attemptTime.getTime() + 16 * 60 * 1000);
		const allowed = checkRateLimit(db, IP, EMAIL, later);
		expect(allowed.allowed).toBe(true);
	});
});

describe('recordLoginAttempt', () => {
	it('should insert attempt record', () => {
		recordLoginAttempt(db, IP, EMAIL, false);
		const rows = db.select().from(loginAttempts).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].ip).toBe(IP);
		expect(rows[0].email).toBe(EMAIL);
	});

	it('should record success/failure flag correctly', () => {
		recordLoginAttempt(db, IP, EMAIL, true);
		recordLoginAttempt(db, IP, EMAIL, false);
		const rows = db.select().from(loginAttempts).all();
		expect(rows[0].success).toBe(true);
		expect(rows[1].success).toBe(false);
	});
});

describe('clearOldAttempts', () => {
	it('should remove attempts older than 2x lockout', () => {
		const old = new Date('2024-01-01T00:00:00Z');
		const recent = new Date('2024-01-01T01:00:00Z');
		recordLoginAttempt(db, IP, EMAIL, false, old);
		recordLoginAttempt(db, IP, EMAIL, false, recent);

		// Clear at a time where old is > 2x lockout (30 min) ago but recent is not
		const clearTime = new Date(old.getTime() + 31 * 60 * 1000);
		clearOldAttempts(db, clearTime);

		const rows = db.select().from(loginAttempts).all();
		expect(rows).toHaveLength(1);
	});
});
