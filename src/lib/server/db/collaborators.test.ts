import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { notes, noteCollaborators, noteUserState, users } from './schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './schema.js';

let db: BetterSQLite3Database<typeof schema>;

function seedTwoUsers(db: BetterSQLite3Database<typeof schema>) {
	db.insert(users)
		.values([
			{ email: 'owner@test.com', displayName: 'Owner', role: 'admin', authProvider: 'password', createdAt: new Date() },
			{ email: 'collab@test.com', displayName: 'Collaborator', role: 'user', authProvider: 'password', createdAt: new Date() }
		])
		.run();
}

function seedNote(db: BetterSQLite3Database<typeof schema>, id: string, userId: number) {
	const now = new Date();
	db.insert(notes).values({ id, userId, title: 'Test', content: '', createdAt: now, updatedAt: now }).run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedTwoUsers(db);
});

describe('noteCollaborators table', () => {
	it('should add a collaborator to a note', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteCollaborators)
			.values({ noteId: 'n1', userId: 2, addedBy: 1, addedAt: new Date() })
			.run();

		const result = db.select().from(noteCollaborators).where(eq(noteCollaborators.noteId, 'n1')).all();
		expect(result).toHaveLength(1);
		expect(result[0].userId).toBe(2);
		expect(result[0].addedBy).toBe(1);
	});

	it('should enforce unique constraint on (noteId, userId)', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteCollaborators)
			.values({ noteId: 'n1', userId: 2, addedBy: 1, addedAt: new Date() })
			.run();

		expect(() =>
			db.insert(noteCollaborators)
				.values({ noteId: 'n1', userId: 2, addedBy: 1, addedAt: new Date() })
				.run()
		).toThrow();
	});

	it('should allow multiple collaborators per note', () => {
		seedNote(db, 'n1', 1);
		// Add a third user
		db.insert(users)
			.values({ email: 'third@test.com', displayName: 'Third', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();

		db.insert(noteCollaborators).values([
			{ noteId: 'n1', userId: 2, addedBy: 1, addedAt: new Date() },
			{ noteId: 'n1', userId: 3, addedBy: 1, addedAt: new Date() }
		]).run();

		const result = db.select().from(noteCollaborators).where(eq(noteCollaborators.noteId, 'n1')).all();
		expect(result).toHaveLength(2);
	});

	it('should remove a collaborator', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteCollaborators)
			.values({ noteId: 'n1', userId: 2, addedBy: 1, addedAt: new Date() })
			.run();

		db.delete(noteCollaborators)
			.where(and(eq(noteCollaborators.noteId, 'n1'), eq(noteCollaborators.userId, 2)))
			.run();

		const result = db.select().from(noteCollaborators).where(eq(noteCollaborators.noteId, 'n1')).all();
		expect(result).toHaveLength(0);
	});
});

describe('noteUserState table', () => {
	it('should store per-user pin/archive/sortOrder state', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteUserState)
			.values({ noteId: 'n1', userId: 2, pinned: true, archived: false, sortOrder: 5 })
			.run();

		const result = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, 2)))
			.get();

		expect(result).toBeDefined();
		expect(result!.pinned).toBe(true);
		expect(result!.archived).toBe(false);
		expect(result!.sortOrder).toBe(5);
	});

	it('should enforce unique constraint on (noteId, userId)', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteUserState)
			.values({ noteId: 'n1', userId: 2, pinned: false, archived: false, sortOrder: 0 })
			.run();

		expect(() =>
			db.insert(noteUserState)
				.values({ noteId: 'n1', userId: 2, pinned: true, archived: false, sortOrder: 0 })
				.run()
		).toThrow();
	});

	it('should default to false/false/0 for new state', () => {
		seedNote(db, 'n1', 1);
		db.insert(noteUserState)
			.values({ noteId: 'n1', userId: 2 })
			.run();

		const result = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, 2)))
			.get();

		expect(result!.pinned).toBe(false);
		expect(result!.archived).toBe(false);
		expect(result!.sortOrder).toBe(0);
	});

	it('should allow independent state per user per note', () => {
		seedNote(db, 'n1', 1);
		db.insert(users)
			.values({ email: 'third@test.com', displayName: 'Third', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();

		db.insert(noteUserState).values([
			{ noteId: 'n1', userId: 2, pinned: true, archived: false, sortOrder: 1 },
			{ noteId: 'n1', userId: 3, pinned: false, archived: true, sortOrder: 2 }
		]).run();

		const user2State = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, 2))).get();
		const user3State = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, 3))).get();

		expect(user2State!.pinned).toBe(true);
		expect(user2State!.archived).toBe(false);
		expect(user3State!.pinned).toBe(false);
		expect(user3State!.archived).toBe(true);
	});
});
