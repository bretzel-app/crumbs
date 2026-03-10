import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, noteCollaborators, users } from './db/schema.js';
import type { Db } from './db/index.js';
import { canAccessNote, requireNoteAccess, requireNoteOwnership, getUserId } from './api-utils.js';

let db: Db;
const OWNER_ID = 1;
const COLLAB_ID = 2;
const STRANGER_ID = 3;

function seedUsers() {
	db.insert(users)
		.values([
			{ email: 'owner@test.com', displayName: 'Owner', role: 'admin', authProvider: 'password', createdAt: new Date() },
			{ email: 'collab@test.com', displayName: 'Collab', role: 'user', authProvider: 'password', createdAt: new Date() },
			{ email: 'stranger@test.com', displayName: 'Stranger', role: 'user', authProvider: 'password', createdAt: new Date() }
		])
		.run();
}

function seedNote(id: string) {
	db.insert(notes)
		.values({ id, userId: OWNER_ID, title: 'Test', content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

function shareNote(noteId: string) {
	db.insert(noteCollaborators)
		.values({ noteId, userId: COLLAB_ID, addedBy: OWNER_ID, addedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUsers();
});

describe('canAccessNote', () => {
	it('should allow owner to access their note', () => {
		seedNote('n1');
		const result = canAccessNote(db, 'n1', OWNER_ID);
		expect(result).toEqual({ canAccess: true, isOwner: true });
	});

	it('should allow collaborator to access shared note', () => {
		seedNote('n1');
		shareNote('n1');
		const result = canAccessNote(db, 'n1', COLLAB_ID);
		expect(result).toEqual({ canAccess: true, isOwner: false });
	});

	it('should deny non-collaborator access', () => {
		seedNote('n1');
		const result = canAccessNote(db, 'n1', STRANGER_ID);
		expect(result).toEqual({ canAccess: false, isOwner: false });
	});

	it('should return false for non-existent note', () => {
		const result = canAccessNote(db, 'nonexistent', OWNER_ID);
		expect(result).toEqual({ canAccess: false, isOwner: false });
	});
});

describe('requireNoteAccess', () => {
	it('should throw 404 for unauthorized user', () => {
		seedNote('n1');
		expect(() => requireNoteAccess(db, 'n1', STRANGER_ID)).toThrow();
	});

	it('should return isOwner for authorized owner', () => {
		seedNote('n1');
		expect(requireNoteAccess(db, 'n1', OWNER_ID)).toEqual({ isOwner: true });
	});
});

describe('requireNoteOwnership', () => {
	it('should throw 404 for collaborator', () => {
		seedNote('n1');
		shareNote('n1');
		expect(() => requireNoteOwnership(db, 'n1', COLLAB_ID)).toThrow();
	});

	it('should not throw for owner', () => {
		seedNote('n1');
		expect(() => requireNoteOwnership(db, 'n1', OWNER_ID)).not.toThrow();
	});
});

describe('getUserId', () => {
	it('should throw 401 when no user in locals', () => {
		expect(() => getUserId({ locals: {} as App.Locals })).toThrow();
	});

	it('should return user id from locals', () => {
		const id = getUserId({ locals: { user: { id: 42, role: 'user', email: '', displayName: '' } } as App.Locals });
		expect(id).toBe(42);
	});
});
