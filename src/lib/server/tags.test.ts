import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from './db/test-helpers.js';
import { notes, tags, noteTags, users } from './db/schema.js';
import { eq } from 'drizzle-orm';
import type { Db } from './db/index.js';
import { fetchTagsForNotes, syncNoteTags, getTagColors, setTagColor } from './tags.js';

let db: Db;
const USER_ID = 1;

function seedUser() {
	db.insert(users)
		.values({ email: 'test@test.com', displayName: 'Test', role: 'admin', authProvider: 'password', createdAt: new Date() })
		.run();
}

function seedNote(id: string) {
	db.insert(notes)
		.values({ id, userId: USER_ID, title: '', content: '', createdAt: new Date(), updatedAt: new Date() })
		.run();
}

beforeEach(() => {
	const testDb = createTestDb();
	db = testDb.db;
	seedUser();
});

describe('syncNoteTags', () => {
	it('should create new tags and associations', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['todo', 'urgent'], USER_ID);

		const tagRows = db.select().from(tags).all();
		expect(tagRows).toHaveLength(2);

		const associations = db.select().from(noteTags).all();
		expect(associations).toHaveLength(2);
	});

	it('should remove old associations and add new ones', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['old-tag'], USER_ID);
		syncNoteTags(db, 'n1', ['new-tag'], USER_ID);

		const map = fetchTagsForNotes(db, ['n1']);
		expect(map.get('n1')).toEqual(['new-tag']);
	});

	it('should handle empty tag list (removes all)', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['tag1', 'tag2'], USER_ID);
		syncNoteTags(db, 'n1', [], USER_ID);

		const associations = db.select().from(noteTags).where(eq(noteTags.noteId, 'n1')).all();
		expect(associations).toHaveLength(0);
	});

	it('should deduplicate existing tags', () => {
		seedNote('n1');
		seedNote('n2');
		syncNoteTags(db, 'n1', ['shared-tag'], USER_ID);
		syncNoteTags(db, 'n2', ['shared-tag'], USER_ID);

		// Should reuse the same tag row
		const tagRows = db.select().from(tags).all();
		expect(tagRows).toHaveLength(1);
	});
});

describe('fetchTagsForNotes', () => {
	it('should return Map of noteId to tag names', () => {
		seedNote('n1');
		seedNote('n2');
		syncNoteTags(db, 'n1', ['alpha', 'beta'], USER_ID);
		syncNoteTags(db, 'n2', ['gamma'], USER_ID);

		const map = fetchTagsForNotes(db, ['n1', 'n2']);
		expect(map.get('n1')).toHaveLength(2);
		expect(map.get('n1')).toContain('alpha');
		expect(map.get('n1')).toContain('beta');
		expect(map.get('n2')).toEqual(['gamma']);
	});

	it('should return empty map for empty noteIds', () => {
		const map = fetchTagsForNotes(db, []);
		expect(map.size).toBe(0);
	});

	it('lists tags in the order the note mentions them, not the order they were created', () => {
		seedNote('n1');
		seedNote('n2');
		syncNoteTags(db, 'n1', ['older'], USER_ID);
		syncNoteTags(db, 'n2', ['newer', 'older'], USER_ID);

		expect(fetchTagsForNotes(db, ['n2']).get('n2')).toEqual(['newer', 'older']);
	});
});

describe('tag colours', () => {
	const OTHER_USER_ID = 2;

	function seedOtherUser() {
		db.insert(users)
			.values({ email: 'other@test.com', displayName: 'Other', role: 'user', authProvider: 'password', createdAt: new Date() })
			.run();
	}

	it('has no colours until the user picks one', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['network'], USER_ID);

		expect(getTagColors(db, USER_ID)).toEqual({});
	});

	it('remembers the colour picked for a tag', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['network'], USER_ID);

		setTagColor(db, USER_ID, 'network', 'sand');

		expect(getTagColors(db, USER_ID)).toEqual({ network: 'sand' });
	});

	it('forgets the colour when it is cleared', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['network'], USER_ID);
		setTagColor(db, USER_ID, 'network', 'sand');

		setTagColor(db, USER_ID, 'network', null);

		expect(getTagColors(db, USER_ID)).toEqual({});
	});

	it('treats picking the default colour as clearing it', () => {
		seedNote('n1');
		syncNoteTags(db, 'n1', ['network'], USER_ID);
		setTagColor(db, USER_ID, 'network', 'sand');

		setTagColor(db, USER_ID, 'network', 'default');

		expect(getTagColors(db, USER_ID)).toEqual({});
	});

	it('keeps the colour when the tag is later used by a note', () => {
		setTagColor(db, USER_ID, 'network', 'sand');
		seedNote('n1');

		syncNoteTags(db, 'n1', ['network'], USER_ID);

		expect(db.select().from(tags).all()).toHaveLength(1);
		expect(getTagColors(db, USER_ID)).toEqual({ network: 'sand' });
	});

	it('keeps each user\'s colours to themselves', () => {
		seedOtherUser();
		setTagColor(db, USER_ID, 'network', 'sand');
		setTagColor(db, OTHER_USER_ID, 'network', 'mint');

		expect(getTagColors(db, USER_ID)).toEqual({ network: 'sand' });
		expect(getTagColors(db, OTHER_USER_ID)).toEqual({ network: 'mint' });
	});
});
