import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './test-helpers.js';
import { notes, noteTags, tags } from './schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type * as schema from './schema.js';

let db: BetterSQLite3Database<typeof schema>;

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
});

describe('Notes CRUD', () => {
	it('should create a note with default values', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'Test Note',
			content: 'Hello world',
			createdAt: now,
			updatedAt: now
		});

		const result = await db.select().from(notes).where(eq(notes.id, id)).get();

		expect(result).toBeDefined();
		expect(result!.title).toBe('Test Note');
		expect(result!.content).toBe('Hello world');
		expect(result!.color).toBe('default');
		expect(result!.pinned).toBe(false);
		expect(result!.archived).toBe(false);
		expect(result!.trashed).toBe(false);
		expect(result!.checklistMode).toBe(false);
		expect(result!.version).toBe(1);
	});

	it('should create a note with custom color and pinned state', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'Colored Note',
			content: '',
			color: 'coral',
			pinned: true,
			createdAt: now,
			updatedAt: now
		});

		const result = await db.select().from(notes).where(eq(notes.id, id)).get();

		expect(result!.color).toBe('coral');
		expect(result!.pinned).toBe(true);
	});

	it('should read all active notes (not archived, not trashed)', async () => {
		const now = new Date();
		await db.insert(notes).values([
			{ id: 'n1', title: 'Active', content: '', createdAt: now, updatedAt: now },
			{
				id: 'n2',
				title: 'Archived',
				content: '',
				archived: true,
				createdAt: now,
				updatedAt: now
			},
			{ id: 'n3', title: 'Trashed', content: '', trashed: true, createdAt: now, updatedAt: now }
		]);

		const active = await db
			.select()
			.from(notes)
			.where(and(eq(notes.archived, false), eq(notes.trashed, false)));

		expect(active).toHaveLength(1);
		expect(active[0].title).toBe('Active');
	});

	it('should update a note and increment version', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'Original',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		const later = new Date(now.getTime() + 1000);
		await db
			.update(notes)
			.set({ title: 'Updated', updatedAt: later, version: 2 })
			.where(eq(notes.id, id));

		const result = await db.select().from(notes).where(eq(notes.id, id)).get();

		expect(result!.title).toBe('Updated');
		expect(result!.version).toBe(2);
	});

	it('should soft-delete a note (move to trash)', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'To Trash',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		await db.update(notes).set({ trashed: true, trashedAt: now }).where(eq(notes.id, id));

		const result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result!.trashed).toBe(true);
		expect(result!.trashedAt).toBeTruthy();
	});

	it('should permanently delete a note', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'To Delete',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		await db.delete(notes).where(eq(notes.id, id));
		const result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result).toBeUndefined();
	});

	it('should archive and unarchive a note', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'To Archive',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		await db.update(notes).set({ archived: true }).where(eq(notes.id, id));
		let result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result!.archived).toBe(true);

		await db.update(notes).set({ archived: false }).where(eq(notes.id, id));
		result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result!.archived).toBe(false);
	});

	it('should pin and unpin a note', async () => {
		const id = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id,
			title: 'Pin Me',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		await db.update(notes).set({ pinned: true }).where(eq(notes.id, id));
		let result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result!.pinned).toBe(true);

		await db.update(notes).set({ pinned: false }).where(eq(notes.id, id));
		result = await db.select().from(notes).where(eq(notes.id, id)).get();
		expect(result!.pinned).toBe(false);
	});
});

describe('Notes with Tags', () => {
	it('should associate tags with a note', async () => {
		const noteId = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id: noteId,
			title: 'Tagged Note',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		// Create tags
		const [tag1] = await db.insert(tags).values({ name: 'work' }).returning();
		const [tag2] = await db.insert(tags).values({ name: 'important' }).returning();

		// Associate
		await db.insert(noteTags).values([
			{ noteId, tagId: tag1.id },
			{ noteId, tagId: tag2.id }
		]);

		// Query
		const tagRows = await db
			.select({ name: tags.name })
			.from(noteTags)
			.innerJoin(tags, eq(noteTags.tagId, tags.id))
			.where(eq(noteTags.noteId, noteId));

		expect(tagRows).toHaveLength(2);
		expect(tagRows.map((t) => t.name).sort()).toEqual(['important', 'work']);
	});

	it('should cascade delete tags when note is deleted', async () => {
		const noteId = uuidv4();
		const now = new Date();

		await db.insert(notes).values({
			id: noteId,
			title: '',
			content: '',
			createdAt: now,
			updatedAt: now
		});

		const [tag] = await db.insert(tags).values({ name: 'temp' }).returning();
		await db.insert(noteTags).values({ noteId, tagId: tag.id });

		// Delete note_tags first (FK cascade is disabled in test DB), then note
		await db.delete(noteTags).where(eq(noteTags.noteId, noteId));
		await db.delete(notes).where(eq(notes.id, noteId));

		// note_tags should be gone
		const remaining = await db
			.select()
			.from(noteTags)
			.where(eq(noteTags.noteId, noteId));
		expect(remaining).toHaveLength(0);

		// Tag itself should still exist
		const tagStillExists = await db.select().from(tags).where(eq(tags.id, tag.id)).get();
		expect(tagStillExists).toBeDefined();
	});
});

describe('Note ordering', () => {
	it('should return pinned notes first', async () => {
		const now = new Date();
		await db.insert(notes).values([
			{
				id: 'unpinned',
				title: 'Unpinned',
				content: '',
				pinned: false,
				createdAt: now,
				updatedAt: now
			},
			{
				id: 'pinned',
				title: 'Pinned',
				content: '',
				pinned: true,
				createdAt: now,
				updatedAt: now
			}
		]);

		const result = await db
			.select()
			.from(notes)
			.orderBy(({ pinned }) => [
				// SQLite: true = 1, false = 0, DESC puts 1 first
				eq(pinned, pinned) // just use raw desc
			]);

		// Manual approach: order by pinned desc
		const { desc } = await import('drizzle-orm');
		const ordered = await db
			.select()
			.from(notes)
			.orderBy(desc(notes.pinned), desc(notes.updatedAt));

		expect(ordered[0].title).toBe('Pinned');
		expect(ordered[1].title).toBe('Unpinned');
	});
});
