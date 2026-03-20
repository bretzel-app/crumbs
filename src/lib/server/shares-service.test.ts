import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, users, attachments } from './db/schema.js';
import type { Db } from './db/index.js';
import {
	fetchSharesForNotes,
	createShare,
	revokeShare,
	getShareByNoteId,
	getSharedNote
} from './shares-service.js';

let db: Db;

const OWNER_ID = 1;

function seedUsers() {
	db.insert(users)
		.values([
			{
				email: 'owner@test.com',
				displayName: 'Owner',
				role: 'admin',
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
			title: 'Test Note',
			content: 'Test content',
			createdAt: now,
			updatedAt: now,
			...overrides
		})
		.run();
	return id;
}

beforeEach(() => {
	const result = createTestDb();
	db = result.db;
	seedUsers();
});

describe('createShare', () => {
	it('creates a share and returns a token', () => {
		seedNote('note-1');
		const { token } = createShare(db, 'note-1', OWNER_ID);
		expect(token).toBeDefined();
		expect(token.length).toBe(21);
	});

	it('returns the same token on duplicate creation (idempotent)', () => {
		seedNote('note-1');
		const first = createShare(db, 'note-1', OWNER_ID);
		const second = createShare(db, 'note-1', OWNER_ID);
		expect(first.token).toBe(second.token);
	});

	it('throws 404 for non-existent note', () => {
		expect(() => createShare(db, 'nonexistent', OWNER_ID)).toThrow();
	});
});

describe('revokeShare', () => {
	it('removes the share token', () => {
		seedNote('note-1');
		createShare(db, 'note-1', OWNER_ID);
		revokeShare(db, 'note-1', OWNER_ID);
		const share = getShareByNoteId(db, 'note-1');
		expect(share).toBeNull();
	});
});

describe('getShareByNoteId', () => {
	it('returns null when no share exists', () => {
		seedNote('note-1');
		expect(getShareByNoteId(db, 'note-1')).toBeNull();
	});

	it('returns share when one exists', () => {
		seedNote('note-1');
		const { token } = createShare(db, 'note-1', OWNER_ID);
		const share = getShareByNoteId(db, 'note-1');
		expect(share).not.toBeNull();
		expect(share!.token).toBe(token);
	});
});

describe('getSharedNote', () => {
	it('returns note data for valid token', () => {
		seedNote('note-1', { title: 'Shared Title', content: 'Shared content' });
		const { token } = createShare(db, 'note-1', OWNER_ID);

		const data = getSharedNote(db, token);
		expect(data).not.toBeNull();
		expect(data!.title).toBe('Shared Title');
		expect(data!.content).toBe('Shared content');
	});

	it('returns null for trashed note', () => {
		seedNote('note-1', { trashed: true });
		const { token } = createShare(db, 'note-1', OWNER_ID);

		expect(getSharedNote(db, token)).toBeNull();
	});

	it('returns null for invalid token', () => {
		expect(getSharedNote(db, 'invalid-token')).toBeNull();
	});

	it('includes attachments', () => {
		seedNote('note-1');
		db.insert(attachments)
			.values({
				id: 'att-1',
				userId: OWNER_ID,
				noteId: 'note-1',
				filename: 'image.png',
				mimeType: 'image/png',
				size: 1024,
				path: '/data/attachments/att-1.png',
				createdAt: new Date()
			})
			.run();
		const { token } = createShare(db, 'note-1', OWNER_ID);

		const data = getSharedNote(db, token);
		expect(data!.attachments).toHaveLength(1);
		expect(data!.attachments[0].filename).toBe('image.png');
	});
});

describe('fetchSharesForNotes', () => {
	it('returns empty map for no notes', () => {
		const result = fetchSharesForNotes(db, []);
		expect(result.size).toBe(0);
	});

	it('returns tokens for shared notes', () => {
		seedNote('note-1');
		seedNote('note-2');
		seedNote('note-3');
		const { token: token1 } = createShare(db, 'note-1', OWNER_ID);
		const { token: token2 } = createShare(db, 'note-2', OWNER_ID);

		const result = fetchSharesForNotes(db, ['note-1', 'note-2', 'note-3']);
		expect(result.size).toBe(2);
		expect(result.get('note-1')).toBe(token1);
		expect(result.get('note-2')).toBe(token2);
		expect(result.get('note-3')).toBeUndefined();
	});
});
