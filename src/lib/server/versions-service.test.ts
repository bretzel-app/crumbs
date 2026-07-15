import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { users, notes, noteVersions } from './db/schema.js';
import { eq } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { createSnapshot, listVersions, getVersion, snapshotCurrentNote, getBaseContent } from './versions-service.js';

let db: Db;

const OWNER_ID = 1;
const NOTE_ID = 'note-history-test';

function seedUser() {
	db.insert(users)
		.values({
			id: OWNER_ID,
			email: 'owner@test.com',
			displayName: 'Owner',
			role: 'admin',
			authProvider: 'password',
			createdAt: new Date()
		})
		.run();
}

function seedNote(overrides: Partial<typeof notes.$inferInsert> = {}) {
	const now = new Date();
	db.insert(notes)
		.values({
			id: NOTE_ID,
			userId: OWNER_ID,
			title: 'Test Note',
			content: 'Test content',
			createdAt: now,
			updatedAt: now,
			version: 1,
			...overrides
		})
		.run();
}

beforeEach(() => {
	({ db } = createTestDb());
	seedUser();
});

describe('getBaseContent', () => {
	it('returns null when the base version is unknown', () => {
		seedNote();
		expect(getBaseContent(db, NOTE_ID, undefined)).toBeNull();
	});

	it('returns the snapshot content at or before the base version', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, { version: 1, title: 'T', content: 'v1', checklistMode: false, color: 'default' });
		createSnapshot(db, NOTE_ID, { version: 3, title: 'T', content: 'v3', checklistMode: false, color: 'default' });

		expect(getBaseContent(db, NOTE_ID, 2)).toBe('v1');
		expect(getBaseContent(db, NOTE_ID, 3)).toBe('v3');
	});

	it('returns null instead of a newer snapshot when none exists at or before the base version', () => {
		seedNote();
		// Only a snapshot NEWER than the requested base exists (e.g. the real base was
		// pruned). Using it as the merge base would treat unseen lines as deletions,
		// so getBaseContent must return null rather than fall back to it.
		createSnapshot(db, NOTE_ID, { version: 5, title: 'T', content: 'v5', checklistMode: false, color: 'default' });

		expect(getBaseContent(db, NOTE_ID, 2)).toBeNull();
	});
});

describe('createSnapshot', () => {
	it('should store a snapshot for a note', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, {
			version: 1,
			title: 'Test Note',
			content: 'Test content',
			checklistMode: false,
			color: 'default'
		});

		const rows = db.select().from(noteVersions).where(eq(noteVersions.noteId, NOTE_ID)).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].version).toBe(1);
		expect(rows[0].title).toBe('Test Note');
		expect(rows[0].content).toBe('Test content');
		expect(rows[0].checklistMode).toBe(false);
		expect(rows[0].color).toBe('default');
	});

	it('should not duplicate snapshots for the same version (onConflictDoNothing)', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, { version: 1, title: 'A', content: '', checklistMode: false, color: 'default' });
		createSnapshot(db, NOTE_ID, { version: 1, title: 'B', content: '', checklistMode: false, color: 'default' });

		const rows = db.select().from(noteVersions).where(eq(noteVersions.noteId, NOTE_ID)).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe('A'); // first one wins
	});

	it('should prune to at most 50 snapshots', () => {
		seedNote();
		for (let i = 1; i <= 55; i++) {
			createSnapshot(db, NOTE_ID, {
				version: i,
				title: `Version ${i}`,
				content: '',
				checklistMode: false,
				color: 'default'
			});
		}

		const rows = db.select().from(noteVersions).where(eq(noteVersions.noteId, NOTE_ID)).all();
		expect(rows).toHaveLength(50);
		// Oldest (v1–v5) should be pruned; newest (v6–v55) should remain
		const versions = rows.map((r) => r.version);
		expect(Math.min(...versions)).toBe(6);
		expect(Math.max(...versions)).toBe(55);
	});
});

describe('listVersions', () => {
	it('should return an empty array when there are no versions', () => {
		seedNote();
		expect(listVersions(db, NOTE_ID)).toEqual([]);
	});

	it('should return summaries sorted newest first', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, { version: 1, title: 'First', content: 'Hello world', checklistMode: false, color: 'default' });
		createSnapshot(db, NOTE_ID, { version: 2, title: 'Second', content: 'Updated content here', checklistMode: false, color: 'mint' });

		const summaries = listVersions(db, NOTE_ID);
		expect(summaries).toHaveLength(2);
		expect(summaries[0].version).toBe(2); // newest first
		expect(summaries[1].version).toBe(1);
	});

	it('should truncate contentPreview to 80 characters', () => {
		seedNote();
		const longContent = 'a'.repeat(200);
		createSnapshot(db, NOTE_ID, { version: 1, title: 'T', content: longContent, checklistMode: false, color: 'default' });

		const summaries = listVersions(db, NOTE_ID);
		expect(summaries[0].contentPreview).toHaveLength(80);
	});

	it('should include correct summary fields', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, { version: 3, title: 'My Title', content: 'My content', checklistMode: false, color: 'coral' });

		const summaries = listVersions(db, NOTE_ID);
		expect(summaries[0]).toMatchObject({
			noteId: NOTE_ID,
			version: 3,
			title: 'My Title',
			contentPreview: 'My content'
		});
		expect(summaries[0].id).toBeTruthy();
		expect(summaries[0].createdAt).toBeInstanceOf(Date);
	});
});

describe('getVersion', () => {
	it('should return null for a non-existent version', () => {
		seedNote();
		expect(getVersion(db, NOTE_ID, 'non-existent-id')).toBeNull();
	});

	it('should return the full version content', () => {
		seedNote();
		createSnapshot(db, NOTE_ID, {
			version: 2,
			title: 'Full Title',
			content: '# Heading\n\nSome content',
			checklistMode: true,
			color: 'mint'
		});

		const summaries = listVersions(db, NOTE_ID);
		const versionId = summaries[0].id;

		const version = getVersion(db, NOTE_ID, versionId);
		expect(version).not.toBeNull();
		expect(version!.version).toBe(2);
		expect(version!.title).toBe('Full Title');
		expect(version!.content).toBe('# Heading\n\nSome content');
		expect(version!.checklistMode).toBe(true);
		expect(version!.color).toBe('mint');
	});

	it('should not return a version from a different note', () => {
		const OTHER_NOTE_ID = 'other-note';
		seedNote();
		db.insert(notes).values({
			id: OTHER_NOTE_ID,
			userId: OWNER_ID,
			title: 'Other',
			content: '',
			createdAt: new Date(),
			updatedAt: new Date(),
			version: 1
		}).run();

		createSnapshot(db, OTHER_NOTE_ID, { version: 1, title: 'Other', content: 'Other content', checklistMode: false, color: 'default' });
		const summaries = listVersions(db, OTHER_NOTE_ID);
		const versionId = summaries[0].id;

		// Requesting version from wrong noteId returns null
		expect(getVersion(db, NOTE_ID, versionId)).toBeNull();
	});
});

describe('snapshotCurrentNote', () => {
	it('should return false for a non-existent note', () => {
		expect(snapshotCurrentNote(db, 'non-existent')).toBe(false);
	});

	it('should snapshot the current note state', () => {
		seedNote({ title: 'Current Title', content: 'Current content', version: 5 });

		const result = snapshotCurrentNote(db, NOTE_ID);
		expect(result).toBe(true);

		const rows = db.select().from(noteVersions).where(eq(noteVersions.noteId, NOTE_ID)).all();
		expect(rows).toHaveLength(1);
		expect(rows[0].version).toBe(5);
		expect(rows[0].title).toBe('Current Title');
		expect(rows[0].content).toBe('Current content');
	});
});
