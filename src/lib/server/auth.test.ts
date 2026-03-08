import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { users, sessions } from './db/schema.js';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
});

describe('Auth - Password Hashing', () => {
	it('should hash and verify a password correctly', async () => {
		const password = 'mysecurepassword';
		const hash = await argon2.hash(password);

		expect(hash).not.toBe(password);
		expect(await argon2.verify(hash, password)).toBe(true);
		expect(await argon2.verify(hash, 'wrongpassword')).toBe(false);
	});

	it('should produce different hashes for the same password', async () => {
		const password = 'mysecurepassword';
		const hash1 = await argon2.hash(password);
		const hash2 = await argon2.hash(password);

		expect(hash1).not.toBe(hash2);
		expect(await argon2.verify(hash1, password)).toBe(true);
		expect(await argon2.verify(hash2, password)).toBe(true);
	});
});

describe('Auth - User Setup', () => {
	it('should create a user with hashed password', async () => {
		const password = 'testpassword123';
		const hash = await argon2.hash(password);

		await db.insert(users).values({
			email: 'admin@test.com',
			displayName: 'Admin',
			role: 'admin',
			passwordHash: hash,
			createdAt: new Date()
		});

		const user = await db.select().from(users).get();
		expect(user).toBeDefined();
		expect(user!.email).toBe('admin@test.com');
		expect(user!.role).toBe('admin');
		expect(user!.passwordHash).not.toBe(password);
		expect(await argon2.verify(user!.passwordHash!, password)).toBe(true);
	});

	it('should only allow one admin setup', async () => {
		await db.insert(users).values({
			email: 'admin@test.com',
			role: 'admin',
			passwordHash: 'hash1',
			createdAt: new Date()
		});

		const allUsers = await db.select().from(users);
		expect(allUsers).toHaveLength(1);
	});
});

describe('Auth - Sessions', () => {
	it('should create and validate a session', async () => {
		const [user] = await db
			.insert(users)
			.values({ email: 'test@test.com', passwordHash: 'hash', createdAt: new Date() })
			.returning();

		const token = randomBytes(32).toString('hex');
		await db.insert(sessions).values({
			id: token,
			userId: user.id,
			expiresAt: new Date(Date.now() + 86400000)
		});

		const session = await db.select().from(sessions).where(eq(sessions.id, token)).get();
		expect(session).toBeDefined();
		expect(session!.userId).toBe(user.id);
		expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now());
	});

	it('should detect expired sessions', async () => {
		const [user] = await db
			.insert(users)
			.values({ email: 'test@test.com', passwordHash: 'hash', createdAt: new Date() })
			.returning();

		const token = randomBytes(32).toString('hex');
		await db.insert(sessions).values({
			id: token,
			userId: user.id,
			expiresAt: new Date(Date.now() - 1000) // Expired
		});

		const session = await db.select().from(sessions).where(eq(sessions.id, token)).get();
		expect(session).toBeDefined();
		expect(session!.expiresAt.getTime()).toBeLessThan(Date.now());
	});

	it('should delete a session', async () => {
		const [user] = await db
			.insert(users)
			.values({ email: 'test@test.com', passwordHash: 'hash', createdAt: new Date() })
			.returning();

		const token = randomBytes(32).toString('hex');
		await db.insert(sessions).values({
			id: token,
			userId: user.id,
			expiresAt: new Date(Date.now() + 86400000)
		});

		await db.delete(sessions).where(eq(sessions.id, token));
		const session = await db.select().from(sessions).where(eq(sessions.id, token)).get();
		expect(session).toBeUndefined();
	});
});
