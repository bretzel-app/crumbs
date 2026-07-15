import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, noteCollaborators, noteUserState, noteVersions, users } from './db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { Db } from './db/index.js';
import {
	listNotes,
	getNote,
	createNote,
	updateNote,
	deleteNote,
	searchNotes,
	reorderNotes
} from './notes-service.js';

let db: Db;

const OWNER_ID = 1;
const COLLAB_ID = 2;

function seedUsers() {
	db.insert(users)
		.values([
			{
				email: 'owner@test.com',
				displayName: 'Owner',
				role: 'admin',
				authProvider: 'password',
				createdAt: new Date()
			},
			{
				email: 'collab@test.com',
				displayName: 'Collab',
				role: 'user',
				authProvider: 'password',
				createdAt: new Date()
			}
		])
		.run();
}

function seedNote(
	id: string,
	overrides: Partial<typeof notes.$inferInsert> = {}
) {
	const now = new Date();
	db.insert(notes)
		.values({
			id,
			userId: OWNER_ID,
			title: '',
			content: '',
			createdAt: now,
			updatedAt: now,
			...overrides
		})
		.run();
	return id;
}

function shareNote(noteId: string, userId = COLLAB_ID) {
	db.insert(noteCollaborators)
		.values({
			noteId,
			userId,
			addedBy: OWNER_ID,
			addedAt: new Date()
		})
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUsers();
});

describe('listNotes', () => {
	it('should return only active owned notes (excludes archived/trashed)', () => {
		seedNote('active', { title: 'Active' });
		seedNote('archived', { title: 'Archived', archived: true });
		seedNote('trashed', { title: 'Trashed', trashed: true });

		const result = listNotes(db, OWNER_ID);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Active');
	});

	it('should include shared notes with per-user state overlay', () => {
		seedNote('shared', { title: 'Shared Note' });
		shareNote('shared');
		db.insert(noteUserState)
			.values({ noteId: 'shared', userId: COLLAB_ID, pinned: true, archived: false, sortOrder: 5 })
			.run();

		const result = listNotes(db, COLLAB_ID);
		expect(result).toHaveLength(1);
		expect(result[0].title).toBe('Shared Note');
		expect(result[0].pinned).toBeTruthy();
		expect(result[0].sortOrder).toBe(5);
	});

	it('should sort pinned first, then by updatedAt desc', () => {
		const old = new Date('2024-01-01');
		const recent = new Date('2024-01-02');
		seedNote('old-pinned', { title: 'Old Pinned', pinned: true, updatedAt: old, createdAt: old });
		seedNote('recent', { title: 'Recent', updatedAt: recent, createdAt: recent });
		seedNote('old', { title: 'Old', updatedAt: old, createdAt: old });

		const result = listNotes(db, OWNER_ID);
		expect(result.map((n) => n.title)).toEqual(['Old Pinned', 'Recent', 'Old']);
	});

	it('should return only archived notes with archived filter', () => {
		seedNote('active', { title: 'Active' });
		seedNote('archived', { title: 'Archived', archived: true });
		seedNote('shared', { title: 'Shared Archived' });
		shareNote('shared');
		db.insert(noteUserState)
			.values({ noteId: 'shared', userId: COLLAB_ID, pinned: false, archived: true, sortOrder: 0 })
			.run();

		// Owner sees their archived note
		const ownerResult = listNotes(db, OWNER_ID, 'archived');
		expect(ownerResult).toHaveLength(1);
		expect(ownerResult[0].title).toBe('Archived');

		// Collaborator sees shared note they archived
		const collabResult = listNotes(db, COLLAB_ID, 'archived');
		expect(collabResult).toHaveLength(1);
		expect(collabResult[0].title).toBe('Shared Archived');
	});

	it('should exclude shared notes from trashed filter', () => {
		seedNote('trashed', { title: 'Trashed', trashed: true });
		seedNote('shared', { title: 'Shared' });
		shareNote('shared');

		const result = listNotes(db, COLLAB_ID, 'trashed');
		expect(result).toHaveLength(0);
	});
});

describe('getNote', () => {
	it('should return null for non-existent note', () => {
		expect(getNote(db, OWNER_ID, 'nonexistent')).toBeNull();
	});

	it('should return null if user has no access', () => {
		seedNote('private', { title: 'Private' });
		expect(getNote(db, COLLAB_ID, 'private')).toBeNull();
	});

	it('should overlay collaborator per-user state', () => {
		seedNote('shared', { title: 'Shared', pinned: true, sortOrder: 10 });
		shareNote('shared');
		db.insert(noteUserState)
			.values({ noteId: 'shared', userId: COLLAB_ID, pinned: false, archived: true, sortOrder: 5 })
			.run();

		const note = getNote(db, COLLAB_ID, 'shared');
		expect(note).not.toBeNull();
		expect(note!.pinned).toBeFalsy();
		expect(note!.archived).toBeTruthy();
		expect(note!.sortOrder).toBe(5);
	});
});

describe('createNote', () => {
	it('should generate UUID and set version=1', () => {
		const note = createNote(db, OWNER_ID, { title: 'Test' });
		expect(note.id).toBeDefined();
		expect(note.id.length).toBe(36); // UUID format
		expect(note.version).toBe(1);
	});

	it('should use provided ID when given', () => {
		const note = createNote(db, OWNER_ID, { id: 'custom-id', title: 'Test' });
		expect(note.id).toBe('custom-id');
	});

	it('should extract tags from content', () => {
		const note = createNote(db, OWNER_ID, {
			title: 'My #todo note',
			content: 'Some #important content'
		});
		expect(note.tags).toContain('todo');
		expect(note.tags).toContain('important');
	});
});

describe('updateNote', () => {
	it('should allow owner to update shared fields directly', () => {
		seedNote('n1', { title: 'Original' });
		const updated = updateNote(db, OWNER_ID, 'n1', { title: 'Updated' });
		expect(updated).not.toBeNull();
		expect(updated!.title).toBe('Updated');
	});

	it('should allow collaborator to edit content', () => {
		seedNote('n1', { title: 'Original', content: 'Old' });
		shareNote('n1');
		const updated = updateNote(db, COLLAB_ID, 'n1', { content: 'New content' });
		expect(updated).not.toBeNull();
		expect(updated!.content).toBe('New content');
	});

	it('should route collaborator per-user fields to noteUserState', () => {
		seedNote('n1', { title: 'Note', pinned: false });
		shareNote('n1');
		updateNote(db, COLLAB_ID, 'n1', { pinned: true, sortOrder: 7 });

		// Owner's note pinned should be unchanged
		const ownerView = getNote(db, OWNER_ID, 'n1');
		expect(ownerView!.pinned).toBeFalsy();

		// Collaborator sees their per-user state
		const collabView = getNote(db, COLLAB_ID, 'n1');
		expect(collabView!.pinned).toBeTruthy();
		expect(collabView!.sortOrder).toBe(7);
	});

	it('should return null when collaborator tries to trash', () => {
		seedNote('n1', { title: 'Note' });
		shareNote('n1');
		const result = updateNote(db, COLLAB_ID, 'n1', { trashed: true });
		expect(result).toBeNull();
	});

	it('should increment version on update', () => {
		seedNote('n1', { title: 'V1' });
		const updated = updateNote(db, OWNER_ID, 'n1', { title: 'V2' });
		expect(updated!.version).toBe(2);
	});

	it('should create a snapshot when content changes', () => {
		seedNote('n1', { title: 'Original', content: 'Hello', color: 'default', checklistMode: false });
		updateNote(db, OWNER_ID, 'n1', { title: 'Changed' });

		const snapshots = db.select().from(noteVersions).where(eq(noteVersions.noteId, 'n1')).all();
		expect(snapshots).toHaveLength(1);
	});

	it('should not create a snapshot when no content field actually changed', () => {
		seedNote('n1', { title: 'Same', content: 'Same', color: 'default', checklistMode: false });
		// Send the same values — nothing actually changes
		updateNote(db, OWNER_ID, 'n1', { title: 'Same', content: 'Same' });

		const snapshots = db.select().from(noteVersions).where(eq(noteVersions.noteId, 'n1')).all();
		expect(snapshots).toHaveLength(0);
	});

	it('should not create a snapshot when only non-content fields change (pinned, archived)', () => {
		seedNote('n1', { title: 'Note', pinned: false });
		updateNote(db, OWNER_ID, 'n1', { pinned: true });

		const snapshots = db.select().from(noteVersions).where(eq(noteVersions.noteId, 'n1')).all();
		expect(snapshots).toHaveLength(0);
	});

	it('should extract and sync tags on title/content change', () => {
		seedNote('n1', { title: 'Original' });
		const updated = updateNote(db, OWNER_ID, 'n1', { title: 'Now with #newtag' });
		expect(updated!.tags).toContain('newtag');
	});

	it('should merge concurrent content edits using the snapshot created by the first update', () => {
		seedNote('n1', {
			title: 'Shopping',
			content: '- [ ] Milk\n- [ ] Bread',
			checklistMode: true,
			version: 1
		});
		shareNote('n1');

		const ownerUpdate = updateNote(db, OWNER_ID, 'n1', {
			content: '- [ ] Milk\n- [x] Bread',
			baseVersion: 1
		});
		expect(ownerUpdate!.version).toBe(2);

		const collabUpdate = updateNote(db, COLLAB_ID, 'n1', {
			content: '- [x] Milk\n- [ ] Bread',
			baseVersion: 1
		});

		expect(collabUpdate!.content).toBe('- [x] Milk\n- [x] Bread');
		const snapshots = db.select().from(noteVersions).where(eq(noteVersions.noteId, 'n1')).all();
		expect(snapshots.some((snapshot) => snapshot.version === 1)).toBe(true);
	});

	it('should keep the incoming edit when a metadata-only bump left no base snapshot', () => {
		seedNote('n1', { title: 'Note', content: 'hello', version: 1 });

		// A metadata-only change bumps the version but creates no snapshot.
		updateNote(db, OWNER_ID, 'n1', { pinned: true });
		const snapshots = db.select().from(noteVersions).where(eq(noteVersions.noteId, 'n1')).all();
		expect(snapshots).toHaveLength(0);

		// A later concurrent content edit based on the pre-bump version therefore has
		// no base to merge against — the incoming edit must be preserved, not dropped.
		const edited = updateNote(db, OWNER_ID, 'n1', { content: 'hello world', baseVersion: 1 });

		expect(edited!.content).toBe('hello world');
	});
});

describe('deleteNote', () => {
	it('should allow owner to permanently delete', () => {
		seedNote('n1', { title: 'Delete me' });
		const result = deleteNote(db, OWNER_ID, 'n1');
		expect(result).toBe(true);
		expect(getNote(db, OWNER_ID, 'n1')).toBeNull();
	});

	it('should return false for non-existent or unauthorized', () => {
		seedNote('n1', { title: 'Private' });
		expect(deleteNote(db, COLLAB_ID, 'n1')).toBe(false);
		expect(deleteNote(db, OWNER_ID, 'nonexistent')).toBe(false);
	});
});

describe('searchNotes', () => {
	it('should match title and content', () => {
		seedNote('n1', { title: 'Meeting notes', content: 'Discuss budget' });
		seedNote('n2', { title: 'Shopping list', content: 'Buy milk' });

		const results = searchNotes(db, OWNER_ID, 'budget');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('n1');
	});

	it('should include shared notes in results', () => {
		seedNote('shared', { title: 'Shared doc', content: 'Collaboration' });
		shareNote('shared');

		const results = searchNotes(db, COLLAB_ID, 'Collaboration');
		expect(results).toHaveLength(1);
		expect(results[0].id).toBe('shared');
	});

	it('should return empty array for empty query', () => {
		seedNote('n1', { title: 'Test' });
		expect(searchNotes(db, OWNER_ID, '')).toEqual([]);
	});
});

describe('reorderNotes', () => {
	it('should update owner sortOrder in notes table', () => {
		seedNote('n1', { title: 'A' });
		seedNote('n2', { title: 'B' });
		reorderNotes(db, OWNER_ID, [
			{ id: 'n1', sortOrder: 2 },
			{ id: 'n2', sortOrder: 1 }
		]);

		const n1 = getNote(db, OWNER_ID, 'n1');
		const n2 = getNote(db, OWNER_ID, 'n2');
		expect(n1!.sortOrder).toBe(2);
		expect(n2!.sortOrder).toBe(1);
	});

	it('should update collaborator sortOrder in noteUserState', () => {
		seedNote('n1', { title: 'Note', sortOrder: 0 });
		shareNote('n1');
		reorderNotes(db, COLLAB_ID, [{ id: 'n1', sortOrder: 5 }]);

		// Owner's sortOrder unchanged
		const ownerView = getNote(db, OWNER_ID, 'n1');
		expect(ownerView!.sortOrder).toBe(0);

		// Collaborator sees their sortOrder
		const collabView = getNote(db, COLLAB_ID, 'n1');
		expect(collabView!.sortOrder).toBe(5);
	});
});
