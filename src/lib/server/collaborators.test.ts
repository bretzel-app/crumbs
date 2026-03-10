import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, noteCollaborators, noteUserState, users } from './db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { fetchCollaboratorsForNotes, addCollaborator, removeCollaborator } from './collaborators.js';

let db: Db;
const OWNER_ID = 1;
const COLLAB_ID = 2;

function seedUsers() {
	db.insert(users)
		.values([
			{ email: 'owner@test.com', displayName: 'Owner', role: 'admin', authProvider: 'password', createdAt: new Date() },
			{ email: 'collab@test.com', displayName: 'Collab', role: 'user', authProvider: 'password', createdAt: new Date() }
		])
		.run();
}

function seedNote(id: string) {
	db.insert(notes)
		.values({ id, userId: OWNER_ID, title: 'Test', content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUsers();
});

describe('fetchCollaboratorsForNotes', () => {
	it('should return Map with user details for shared notes', () => {
		seedNote('n1');
		addCollaborator(db, 'n1', COLLAB_ID, OWNER_ID);

		const map = fetchCollaboratorsForNotes(db, ['n1']);
		const collabs = map.get('n1');
		expect(collabs).toHaveLength(1);
		expect(collabs![0].userId).toBe(COLLAB_ID);
		expect(collabs![0].displayName).toBe('Collab');
		expect(collabs![0].email).toBe('collab@test.com');
	});

	it('should return empty Map for notes with no collaborators', () => {
		seedNote('n1');
		const map = fetchCollaboratorsForNotes(db, ['n1']);
		expect(map.size).toBe(0);
	});
});

describe('addCollaborator', () => {
	it('should insert collaborator record', () => {
		seedNote('n1');
		addCollaborator(db, 'n1', COLLAB_ID, OWNER_ID);

		const rows = db.select().from(noteCollaborators).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].userId).toBe(COLLAB_ID);
		expect(rows[0].addedBy).toBe(OWNER_ID);
	});
});

describe('removeCollaborator', () => {
	it('should clean up noteUserState on removal', () => {
		seedNote('n1');
		addCollaborator(db, 'n1', COLLAB_ID, OWNER_ID);
		db.insert(noteUserState)
			.values({ noteId: 'n1', userId: COLLAB_ID, pinned: true, archived: false, sortOrder: 0 })
			.run();

		removeCollaborator(db, 'n1', COLLAB_ID);

		const collabs = db.select().from(noteCollaborators).all();
		expect(collabs).toHaveLength(0);

		const states = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, COLLAB_ID)))
			.all();
		expect(states).toHaveLength(0);
	});
});
