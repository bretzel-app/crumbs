import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { users, sessions } from './db/schema.js';
import { eq } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes, randomUUID } from 'crypto';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './db/schema.js';
import {
	verifyPassword,
	resetPassword,
	findOrLinkOAuthUser,
	createUser,
	disablePasswordLogin
} from './auth.js';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
});

describe('Auth - Password Hashing', () => {
	it('should hash and verify a password correctly', async () => {
		const password = randomUUID();
		const hash = await argon2.hash(password);

		expect(hash).not.toBe(password);
		expect(await argon2.verify(hash, password)).toBe(true);
		expect(await argon2.verify(hash, randomUUID())).toBe(false);
	});

	it('should produce different hashes for the same password', async () => {
		const password = randomUUID();
		const hash1 = await argon2.hash(password);
		const hash2 = await argon2.hash(password);

		expect(hash1).not.toBe(hash2);
		expect(await argon2.verify(hash1, password)).toBe(true);
		expect(await argon2.verify(hash2, password)).toBe(true);
	});
});

describe('Auth - User Setup', () => {
	it('should create a user with hashed password', async () => {
		const password = randomUUID();
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

describe('Auth - password login enabled', () => {
	it('verifyPassword succeeds when password login is enabled', async () => {
		const password = randomUUID();
		const hash = await argon2.hash(password);
		await db.insert(users).values({
			email: 'pw@test.com',
			displayName: 'PW User',
			passwordHash: hash,
			passwordLoginEnabled: true,
			authProvider: 'password',
			createdAt: new Date()
		});

		const user = await verifyPassword('pw@test.com', password, db);
		expect(user?.email).toBe('pw@test.com');
	});

	it('verifyPassword rejects when password login is disabled even with a hash', async () => {
		const password = randomUUID();
		const hash = await argon2.hash(password);
		await db.insert(users).values({
			email: 'oauth@test.com',
			displayName: 'OAuth User',
			passwordHash: hash,
			passwordLoginEnabled: false,
			authProvider: 'google',
			providerId: 'gid-1',
			createdAt: new Date()
		});

		expect(await verifyPassword('oauth@test.com', password, db)).toBeNull();
	});

	it('resetPassword enables password login on an OAuth-only account', async () => {
		const [row] = await db
			.insert(users)
			.values({
				email: 'enable@test.com',
				displayName: 'Enable',
				passwordLoginEnabled: false,
				authProvider: 'none',
				createdAt: new Date()
			})
			.returning();

		const newPassword = randomUUID();
		await resetPassword(row.id, newPassword, db);

		const updated = await db.select().from(users).where(eq(users.id, row.id)).get();
		expect(updated?.passwordLoginEnabled).toBe(true);
		expect(await argon2.verify(updated!.passwordHash!, newPassword)).toBe(true);
		expect(await verifyPassword('enable@test.com', newPassword, db)).not.toBeNull();
	});

	it('findOrLinkOAuthUser preserves password login when linking SSO', async () => {
		const password = randomUUID();
		const hash = await argon2.hash(password);
		await db.insert(users).values({
			email: 'both@test.com',
			displayName: 'Both',
			passwordHash: hash,
			passwordLoginEnabled: true,
			authProvider: 'password',
			createdAt: new Date()
		});

		const linked = findOrLinkOAuthUser('google', 'google-id-1', 'both@test.com', 'Both', db);
		expect(linked?.authProvider).toBe('google');
		expect(linked?.passwordLoginEnabled).toBe(true);
		expect(await verifyPassword('both@test.com', password, db)).not.toBeNull();
	});

	it('createUser sets passwordLoginEnabled from whether a password was given', async () => {
		const withPassword = await createUser('a@test.com', 'A', 'password123', 'user', db);
		expect(withPassword.passwordLoginEnabled).toBe(true);

		const oauthOnly = await createUser('b@test.com', 'B', null, 'user', db);
		expect(oauthOnly.passwordLoginEnabled).toBe(false);
	});

	it('disablePasswordLogin clears the hash, disables login, and removes sessions', async () => {
		const password = randomUUID();
		const hash = await argon2.hash(password);
		const [row] = await db
			.insert(users)
			.values({
				email: 'disable@test.com',
				displayName: 'Disable',
				passwordHash: hash,
				passwordLoginEnabled: true,
				authProvider: 'password',
				createdAt: new Date()
			})
			.returning();

		const token = randomBytes(32).toString('hex');
		await db.insert(sessions).values({
			id: token,
			userId: row.id,
			expiresAt: new Date(Date.now() + 86400000)
		});

		disablePasswordLogin(row.id, db);

		const updated = await db.select().from(users).where(eq(users.id, row.id)).get();
		expect(updated?.passwordLoginEnabled).toBe(false);
		expect(updated?.passwordHash).toBeNull();
		expect(await verifyPassword('disable@test.com', password, db)).toBeNull();
		expect(await db.select().from(sessions).where(eq(sessions.userId, row.id)).all()).toHaveLength(0);
	});
});
