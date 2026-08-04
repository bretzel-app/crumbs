import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, noteLinks, noteCollaborators, users } from './db/schema.js';
import type { Db } from './db/index.js';
import { syncNoteLinks, fetchBacklinksForNote } from './note-links.js';

let db: Db;
const OWNER_ID = 1;
const OTHER_USER_ID = 2;

function seedUser(id: number, email: string) {
	db.insert(users)
		.values({ id, email, displayName: email, role: 'user', authProvider: 'password', createdAt: new Date() })
		.run();
}

function seedNote(id: string, userId: number, title = '') {
	db.insert(notes)
		.values({ id, userId, title, content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUser(OWNER_ID, 'owner@test.com');
	seedUser(OTHER_USER_ID, 'other@test.com');
});

describe('syncNoteLinks', () => {
	it('should create link rows for each target', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);
		seedNote('target-2', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1', 'target-2']);

		const rows = db.select().from(noteLinks).all();
		expect(rows).toHaveLength(2);
	});

	it('should remove old links and add new ones on re-sync', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);
		seedNote('target-2', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1']);
		syncNoteLinks(db, 'source', ['target-2']);

		const rows = db.select().from(noteLinks).all();
		expect(rows).toEqual([{ sourceNoteId: 'source', targetNoteId: 'target-2' }]);
	});

	it('should handle an empty target list (removes all links)', () => {
		seedNote('source', OWNER_ID);
		seedNote('target-1', OWNER_ID);

		syncNoteLinks(db, 'source', ['target-1']);
		syncNoteLinks(db, 'source', []);

		expect(db.select().from(noteLinks).all()).toEqual([]);
	});
});

describe('fetchBacklinksForNote', () => {
	it('should return notes that link to the given note', () => {
		seedNote('source', OWNER_ID, 'Source Note');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);

		const backlinks = fetchBacklinksForNote(db, 'target', OWNER_ID);
		expect(backlinks).toEqual([{ id: 'source', title: 'Source Note' }]);
	});

	it('should return an empty array when nothing links to the note', () => {
		seedNote('target', OWNER_ID, 'Target Note');
		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([]);
	});

	it('should exclude a backlink from a source note the requesting user cannot access', () => {
		seedNote('source', OTHER_USER_ID, 'Other Users Note');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);

		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([]);
	});

	it('should include a backlink from a source note shared with the requesting user', () => {
		seedNote('source', OTHER_USER_ID, 'Shared Source');
		seedNote('target', OWNER_ID, 'Target Note');
		syncNoteLinks(db, 'source', ['target']);
		db.insert(noteCollaborators)
			.values({ noteId: 'source', userId: OWNER_ID, addedBy: OTHER_USER_ID, addedAt: new Date() })
			.run();

		expect(fetchBacklinksForNote(db, 'target', OWNER_ID)).toEqual([{ id: 'source', title: 'Shared Source' }]);
	});
});
