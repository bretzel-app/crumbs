import { db, sqlite, type Db } from './db/index.js';
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
		passwordLoginEnabled: row.passwordLoginEnabled,
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
	displayName?: string,
	dbInstance: Db = db
): Promise<User | null> {
	const existing = dbInstance.select().from(users).get();
	if (existing) return null; // Already set up

	const hash = await argon2.hash(password);
	const result = dbInstance
		.insert(users)
		.values({
			email,
			displayName: displayName || email.split('@')[0] || 'Admin',
			role: 'admin',
			passwordHash: hash,
			passwordLoginEnabled: true,
			authProvider: 'password',
			createdAt: new Date()
		})
		.returning()
		.get();
	return toUser(result);
}

export async function verifyPassword(
	email: string,
	password: string,
	dbInstance: Db = db
): Promise<User | null> {
	const user = dbInstance
		.select()
		.from(users)
		.where(and(eq(users.email, email), eq(users.passwordLoginEnabled, true)))
		.get();
	if (!user || !user.passwordHash) return null;

	const valid = await argon2.verify(user.passwordHash, password);
	return valid ? toUser(user) : null;
}

export async function createSession(
	userId: number,
	meta?: { userAgent?: string; ip?: string }
): Promise<string> {
	const token = randomBytes(32).toString('hex');
	const now = new Date();
	db.insert(sessions)
		.values({
			id: token,
			userId,
			expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
			createdAt: now,
			userAgent: meta?.userAgent || null,
			ip: meta?.ip || null,
			lastUsedAt: now
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

	if (result.expires_at * 1000 < Date.now()) {
		db.delete(sessions).where(eq(sessions.id, token)).run();
		return { valid: false };
	}

	// Update lastUsedAt
	db.update(sessions)
		.set({ lastUsedAt: new Date() })
		.where(eq(sessions.id, token))
		.run();

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

export type SessionInfo = {
	id: string;
	createdAt: Date | null;
	userAgent: string | null;
	ip: string | null;
	lastUsedAt: Date | null;
	expiresAt: Date;
	isCurrent: boolean;
};

export function listUserSessions(userId: number, currentToken: string): SessionInfo[] {
	return db
		.select()
		.from(sessions)
		.where(eq(sessions.userId, userId))
		.all()
		.map((s) => ({
			id: s.id,
			createdAt: s.createdAt,
			userAgent: s.userAgent,
			ip: s.ip,
			lastUsedAt: s.lastUsedAt,
			expiresAt: s.expiresAt,
			isCurrent: s.id === currentToken
		}));
}

export function revokeSession(userId: number, sessionId: string): boolean {
	const session = db
		.select()
		.from(sessions)
		.where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
		.get();
	if (!session) return false;
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
	return true;
}

export function revokeAllSessions(userId: number, exceptToken?: string): void {
	if (exceptToken) {
		sqlite
			.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
			.run(userId, exceptToken);
	} else {
		db.delete(sessions).where(eq(sessions.userId, userId)).run();
	}
}

// --- User CRUD (admin operations) ---

export async function createUser(
	email: string,
	displayName: string,
	password: string | null,
	role: 'admin' | 'user' = 'user',
	dbInstance: Db = db
): Promise<User> {
	const hash = password ? await argon2.hash(password) : null;
	const result = dbInstance
		.insert(users)
		.values({
			email,
			displayName,
			role,
			passwordHash: hash,
			passwordLoginEnabled: !!password,
			authProvider: password ? 'password' : 'none',
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
	// Atomic cascade: all-or-nothing. Also clear rows from other users that
	// reference the deleted user's notes (e.g. sync_log, note_user_state,
	// note_collaborators) so foreign-key checks don't block the final delete.
	const tx = sqlite.transaction((uid: number) => {
		sqlite.prepare('DELETE FROM user_preferences WHERE user_id = ?').run(uid);
		sqlite.prepare('DELETE FROM api_keys WHERE user_id = ?').run(uid);
		sqlite
			.prepare(
				'DELETE FROM note_user_state WHERE user_id = ? OR note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid, uid);
		sqlite
			.prepare(
				'DELETE FROM note_collaborators WHERE user_id = ? OR added_by = ? OR note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid, uid, uid);
		sqlite
			.prepare(
				'DELETE FROM sync_log WHERE user_id = ? OR note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid, uid);
		sqlite
			.prepare(
				'DELETE FROM attachments WHERE user_id = ? OR note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid, uid);
		sqlite
			.prepare(
				'DELETE FROM shared_notes WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid);
		sqlite
			.prepare(
				'DELETE FROM note_tags WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid);
		sqlite
			.prepare(
				'DELETE FROM note_versions WHERE note_id IN (SELECT id FROM notes WHERE user_id = ?)'
			)
			.run(uid);
		sqlite.prepare('DELETE FROM notes WHERE user_id = ?').run(uid);
		sqlite.prepare('DELETE FROM tags WHERE user_id = ?').run(uid);
		sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(uid);
		sqlite.prepare('DELETE FROM users WHERE id = ?').run(uid);
	});
	tx(userId);
}

export async function changePassword(
	userId: number,
	currentPassword: string,
	newPassword: string
): Promise<boolean> {
	const user = db.select().from(users).where(eq(users.id, userId)).get();
	if (!user || !user.passwordHash || !user.passwordLoginEnabled) return false;

	const valid = await argon2.verify(user.passwordHash, currentPassword);
	if (!valid) return false;

	const hash = await argon2.hash(newPassword);
	db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId)).run();
	return true;
}

export async function resetPassword(
	userId: number,
	newPassword: string,
	dbInstance: Db = db
): Promise<void> {
	const hash = await argon2.hash(newPassword);
	dbInstance
		.update(users)
		.set({ passwordHash: hash, passwordLoginEnabled: true })
		.where(eq(users.id, userId))
		.run();
}

export function disablePasswordLogin(userId: number, dbInstance: Db = db): void {
	dbInstance
		.update(users)
		.set({ passwordHash: null, passwordLoginEnabled: false })
		.where(eq(users.id, userId))
		.run();
	dbInstance.delete(sessions).where(eq(sessions.userId, userId)).run();
}

export function updateUserRole(userId: number, role: 'admin' | 'user'): void {
	db.update(users).set({ role }).where(eq(users.id, userId)).run();
}

/**
 * Find a user by OAuth provider, or by email. Invite-only: rejects if no matching user.
 * Linking OAuth updates the provider fields only — password login stays as configured.
 */
export function findOrLinkOAuthUser(
	provider: string,
	providerId: string,
	email: string,
	name: string,
	dbInstance: Db = db
): User | null {
	// First try exact provider+providerId match
	const byProvider = dbInstance
		.select()
		.from(users)
		.where(and(eq(users.authProvider, provider), eq(users.providerId, providerId)))
		.get();
	if (byProvider) return toUser(byProvider);

	// Try matching by email (invite-only: user must already exist)
	const byEmail = dbInstance.select().from(users).where(eq(users.email, email)).get();
	if (!byEmail) return null; // No matching user — not invited

	// Link this OAuth provider to the existing user without touching password login.
	dbInstance
		.update(users)
		.set({ authProvider: provider, providerId, displayName: byEmail.displayName || name })
		.where(eq(users.id, byEmail.id))
		.run();

	return toUser({ ...byEmail, authProvider: provider, providerId });
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
