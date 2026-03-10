import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../server/db/test-helpers.js';
import { notes, noteCollaborators, noteUserState, users, syncLog } from '../server/db/schema.js';
import { eq, and } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from '../server/db/schema.js';
import { getChangesSince, processSyncPush } from './server.js';

let db: BetterSQLite3Database<typeof schema>;

const OWNER_ID = 1;
const COLLAB_ID = 2;

function seedUsers() {
	db.insert(users).values([
		{ email: 'owner@test.com', displayName: 'Owner', role: 'admin', authProvider: 'password', createdAt: new Date() },
		{ email: 'collab@test.com', displayName: 'Collaborator', role: 'user', authProvider: 'password', createdAt: new Date() }
	]).run();
}

function seedSharedNote(id: string, overrides: Partial<typeof notes.$inferInsert> = {}) {
	const now = new Date();
	db.insert(notes).values({
		id,
		userId: OWNER_ID,
		title: 'Shared Note',
		content: 'Original content',
		createdAt: now,
		updatedAt: now,
		...overrides
	}).run();

	db.insert(noteCollaborators).values({
		noteId: id,
		userId: COLLAB_ID,
		addedBy: OWNER_ID,
		addedAt: now
	}).run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUsers();
});

describe('getChangesSince — shared notes', () => {
	it('should return shared notes updated after the given timestamp', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		seedSharedNote('n1', { updatedAt: t2, createdAt: t1 });

		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(1);
		expect(changes[0].id).toBe('n1');
		expect(changes[0].title).toBe('Shared Note');
		expect(changes[0].content).toBe('Original content');
	});

	it('should not return shared notes updated before the given timestamp', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		const changes = await getChangesSince(db, t2.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(0);
	});

	it('should return per-user state overlay for collaborators', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		// Owner has pinned=true, archived=false on the note
		seedSharedNote('n1', { updatedAt: t2, createdAt: t1, pinned: true, archived: false });

		// Collaborator has pinned=false, archived=true in noteUserState
		db.insert(noteUserState).values({
			noteId: 'n1',
			userId: COLLAB_ID,
			pinned: false,
			archived: true,
			sortOrder: 5
		}).run();

		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(1);
		// Should reflect the collaborator's per-user state, not the owner's
		expect(changes[0].pinned).toBeFalsy();
		expect(changes[0].archived).toBeTruthy();
		expect(changes[0].sortOrder).toBe(5);
	});

	it('should default to false/0 when collaborator has no noteUserState', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		// Owner has pinned=true, sortOrder=10
		seedSharedNote('n1', { updatedAt: t2, createdAt: t1, pinned: true, sortOrder: 10 });

		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(1);
		// Without noteUserState, collaborator should get defaults (false/0), not owner's values
		expect(changes[0].pinned).toBeFalsy();
		expect(changes[0].sortOrder).toBe(0);
	});

	it('should not return trashed notes for collaborators', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		seedSharedNote('n1', { updatedAt: t2, createdAt: t1, trashed: true });

		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(0);
	});

	it('should return owner edits to a shared note for the collaborator', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		// Simulate owner editing the note
		const t2 = new Date('2024-01-02T00:00:00Z');
		db.update(notes)
			.set({ content: 'Updated by owner', updatedAt: t2, version: 2 })
			.where(eq(notes.id, 'n1'))
			.run();

		// Collaborator syncs since t1
		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(1);
		expect(changes[0].content).toBe('Updated by owner');
		expect(changes[0].version).toBe(2);
	});

	it('should return both owned and shared notes for a user who is both owner and collaborator on different notes', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		const t2 = new Date('2024-01-02T00:00:00Z');

		// Note owned by COLLAB_ID
		db.insert(notes).values({
			id: 'owned-by-collab',
			userId: COLLAB_ID,
			title: 'My Own Note',
			content: '',
			createdAt: t1,
			updatedAt: t2
		}).run();

		// Note shared with COLLAB_ID (owned by OWNER_ID)
		seedSharedNote('shared-with-collab', { updatedAt: t2, createdAt: t1 });

		const changes = await getChangesSince(db, t1.getTime(), COLLAB_ID);

		expect(changes).toHaveLength(2);
		const ids = changes.map((c) => c.id).sort();
		expect(ids).toEqual(['owned-by-collab', 'shared-with-collab']);
	});
});

describe('processSyncPush — shared notes', () => {
	it('should allow collaborator to update shared content fields', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		const t2 = t1.getTime() + 1000;
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t2,
			data: { title: 'Updated by collab', content: 'New content' }
		}], COLLAB_ID);

		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.title).toBe('Updated by collab');
		expect(note.content).toBe('New content');
		expect(note.version).toBe(2);
	});

	it('should route collaborator per-user fields to noteUserState', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		const t2 = t1.getTime() + 1000;
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t2,
			data: { pinned: true, sortOrder: 3 }
		}], COLLAB_ID);

		// Per-user fields should be in noteUserState, not in notes
		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.pinned).toBe(false); // Owner's pinned state unchanged

		const userState = db.select().from(noteUserState)
			.where(and(eq(noteUserState.noteId, 'n1'), eq(noteUserState.userId, COLLAB_ID)))
			.get();
		expect(userState).toBeDefined();
		expect(userState!.pinned).toBe(true);
		expect(userState!.sortOrder).toBe(3);
	});

	it('should not allow collaborator to trash a note', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		const t2 = t1.getTime() + 1000;
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t2,
			data: { trashed: true }
		}], COLLAB_ID);

		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.trashed).toBe(false);
	});

	it('should reject changes with older timestamp than server note', async () => {
		const t2 = new Date('2024-01-02T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t2, createdAt: new Date('2024-01-01T00:00:00Z') });

		// Collaborator's change has a timestamp BEFORE the server's updatedAt
		const t1 = new Date('2024-01-01T12:00:00Z').getTime();
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t1,
			data: { title: 'Stale edit' }
		}], COLLAB_ID);

		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.title).toBe('Shared Note'); // Unchanged
	});

	it('should not allow non-collaborator to update the note', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		// Create note without sharing with user 3
		db.insert(notes).values({
			id: 'n1',
			userId: OWNER_ID,
			title: 'Private',
			content: '',
			createdAt: t1,
			updatedAt: t1
		}).run();

		// Add a third user
		db.insert(users).values({
			email: 'stranger@test.com',
			displayName: 'Stranger',
			role: 'user',
			authProvider: 'password',
			createdAt: new Date()
		}).run();

		const t2 = t1.getTime() + 1000;
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t2,
			data: { title: 'Hacked' }
		}], 3); // User 3 is not owner or collaborator

		const note = db.select().from(notes).where(eq(notes.id, 'n1')).get()!;
		expect(note.title).toBe('Private'); // Unchanged
	});

	it('should log sync operations', async () => {
		const t1 = new Date('2024-01-01T00:00:00Z');
		seedSharedNote('n1', { updatedAt: t1, createdAt: t1 });

		const t2 = t1.getTime() + 1000;
		await processSyncPush(db, [{
			noteId: 'n1',
			operation: 'update',
			timestamp: t2,
			data: { title: 'Updated' }
		}], COLLAB_ID);

		const logs = db.select().from(syncLog).where(eq(syncLog.noteId, 'n1')).all();
		expect(logs).toHaveLength(1);
		expect(logs[0].userId).toBe(COLLAB_ID);
		expect(logs[0].operation).toBe('update');
	});
});
