import { db, sqlite } from './db/index.js';
import { users, sessions } from './db/schema.js';
import { eq, lt, and } from 'drizzle-orm';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import type { User } from '$lib/types/index.js';

const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

type SessionUser = { id: number; email: string; displayName: string; role: 'admin' | 'user' };

function toUser(row: typeof users.$inferSelect): User {
	return {
		id: row.id,
		email: row.email,
		displayName: row.displayName,
		role: row.role,
		authProvider: row.authProvider,
		providerId: row.providerId,
		createdAt: row.createdAt
	};
}

export async function isSetupComplete(): Promise<boolean> {
	const user = db.select().from(users).get();
	return !!user;
}

export async function setupUser(
	email: string,
	password: string,
	displayName?: string
): Promise<User | null> {
	const existing = db.select().from(users).get();
	if (existing) return null; // Already set up

	const hash = await argon2.hash(password);
	const result = db
		.insert(users)
		.values({
			email,
			displayName: displayName || email.split('@')[0] || 'Admin',
			role: 'admin',
			passwordHash: hash,
			authProvider: 'password',
			createdAt: new Date()
		})
		.returning()
		.get();
	return toUser(result);
}

export async function verifyPassword(
	email: string,
	password: string
): Promise<User | null> {
	const user = db
		.select()
		.from(users)
		.where(and(eq(users.email, email), eq(users.authProvider, 'password')))
		.get();
	if (!user || !user.passwordHash) return null;

	const valid = await argon2.verify(user.passwordHash, password);
	return valid ? toUser(user) : null;
}

export async function createSession(userId: number): Promise<string> {
	const token = randomBytes(32).toString('hex');
	db.insert(sessions)
		.values({
			id: token,
			userId,
			expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
		})
		.run();
	return token;
}

export async function validateSession(
	token: string
): Promise<{ valid: boolean; user?: SessionUser }> {
	if (!token) return { valid: false };

	// Join sessions with users to get user data in one query
	const result = sqlite
		.prepare(
			`SELECT s.id as session_id, s.expires_at, u.id, u.email, u.display_name, u.role
			 FROM sessions s
			 JOIN users u ON s.user_id = u.id
			 WHERE s.id = ?`
		)
		.get(token) as
		| {
				session_id: string;
				expires_at: number;
				id: number;
				email: string;
				display_name: string;
				role: 'admin' | 'user';
		  }
		| undefined;

	if (!result) return { valid: false };

	if (result.expires_at < Date.now()) {
		db.delete(sessions).where(eq(sessions.id, token)).run();
		return { valid: false };
	}

	return {
		valid: true,
		user: {
			id: result.id,
			email: result.email,
			displayName: result.display_name,
			role: result.role
		}
	};
}

export async function deleteSession(token: string): Promise<void> {
	db.delete(sessions).where(eq(sessions.id, token)).run();
}

export async function cleanExpiredSessions(): Promise<void> {
	db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run();
}

// --- User CRUD (admin operations) ---

export async function createUser(
	email: string,
	displayName: string,
	password: string,
	role: 'admin' | 'user' = 'user'
): Promise<User> {
	const hash = await argon2.hash(password);
	const result = db
		.insert(users)
		.values({
			email,
			displayName,
			role,
			passwordHash: hash,
			authProvider: 'password',
			createdAt: new Date()
		})
		.returning()
		.get();
	return toUser(result);
}

export function listUsers(): User[] {
	return db
		.select()
		.from(users)
		.all()
		.map(toUser);
}

export function getUser(userId: number): User | null {
	const row = db.select().from(users).where(eq(users.id, userId)).get();
	return row ? toUser(row) : null;
}

export async function deleteUser(userId: number): Promise<void> {
	// Cascade: delete user's data in dependency order
	sqlite.prepare('DELETE FROM sync_log WHERE user_id = ?').run(userId);
	sqlite.prepare('DELETE FROM attachments WHERE user_id = ?').run(userId);
	sqlite
		.prepare(
			'DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)'
		)
		.run(userId);
	sqlite.prepare('DELETE FROM notes WHERE user_id = ?').run(userId);
	sqlite.prepare('DELETE FROM tags WHERE user_id = ?').run(userId);
	sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
	db.delete(users).where(eq(users.id, userId)).run();
}

export async function changePassword(
	userId: number,
	currentPassword: string,
	newPassword: string
): Promise<boolean> {
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	if (!user || !user.passwordHash) return false;

	const valid = await argon2.verify(user.passwordHash, currentPassword);
	if (!valid) return false;

	const hash = await argon2.hash(newPassword);
	db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId)).run();
	return true;
}

export async function resetPassword(userId: number, newPassword: string): Promise<void> {
	const hash = await argon2.hash(newPassword);
	db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId)).run();
}

export function updateUserRole(userId: number, role: 'admin' | 'user'): void {
	db.update(users).set({ role }).where(eq(users.id, userId)).run();
}

export function updateUserProfile(
	userId: number,
	data: { displayName?: string; email?: string }
): void {
	const updates: Record<string, string> = {};
	if (data.displayName !== undefined) updates.displayName = data.displayName;
	if (data.email !== undefined) updates.email = data.email;
	if (Object.keys(updates).length > 0) {
		db.update(users).set(updates).where(eq(users.id, userId)).run();
	}
}
