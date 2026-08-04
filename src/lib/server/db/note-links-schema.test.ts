import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { createTestDb } from './test-helpers.js';
import { notes, noteLinks, users } from './schema.js';

describe('noteLinks schema', () => {
	it('should store a source/target link row', () => {
		const { db } = createTestDb();
		db.insert(users)
			.values({ email: 'a@test.com', displayName: 'A', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();

		db.insert(notes)
			.values([
				{ id: 'source-note', userId: 1, title: 'Source', content: '', createdAt: new Date(), updatedAt: new Date() },
				{ id: 'target-note', userId: 1, title: 'Target', content: '', createdAt: new Date(), updatedAt: new Date() }
			])
			.run();

		db.insert(noteLinks).values({ sourceNoteId: 'source-note', targetNoteId: 'target-note' }).run();

		const rows = db.select().from(noteLinks).all();
		expect(rows).toEqual([{ sourceNoteId: 'source-note', targetNoteId: 'target-note' }]);
	});

	it('should cascade-delete link rows when the source note is deleted', () => {
		const { db, sqlite } = createTestDb();
		sqlite.pragma('foreign_keys = ON');
		db.insert(users)
			.values({ email: 'a@test.com', displayName: 'A', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();
		db.insert(notes)
			.values([
				{ id: 'source-note', userId: 1, title: 'Source', content: '', createdAt: new Date(), updatedAt: new Date() },
				{ id: 'target-note', userId: 1, title: 'Target', content: '', createdAt: new Date(), updatedAt: new Date() }
			])
			.run();
		db.insert(noteLinks).values({ sourceNoteId: 'source-note', targetNoteId: 'target-note' }).run();

		db.delete(notes).where(eq(notes.id, 'source-note')).run();

		expect(db.select().from(noteLinks).all()).toEqual([]);
	});
});
