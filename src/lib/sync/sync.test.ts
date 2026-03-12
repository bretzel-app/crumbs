import { describe, it, expect } from 'vitest';
import { mergeNotes, hasChanges, diffNotes } from './crdt.js';
import type { Note } from '../types/index.js';

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: 'test-id',
		title: 'Test',
		content: 'Content',
		color: 'default',
		pinned: false,
		archived: false,
		trashed: false,
		trashedAt: null,
		checklistMode: false,
		sortOrder: 0,
		createdAt: new Date('2024-01-01'),
		updatedAt: new Date('2024-01-01'),
		version: 1,
		...overrides
	};
}

describe('mergeNotes (LWW)', () => {
	it('should prefer remote when remote is newer', () => {
		const local = makeNote({ title: 'Local', updatedAt: new Date('2024-01-01') });
		const remote = makeNote({ title: 'Remote', updatedAt: new Date('2024-01-02') });

		const result = mergeNotes(local, remote);
		expect(result.title).toBe('Remote');
	});

	it('should prefer local when local is newer', () => {
		const local = makeNote({ title: 'Local', updatedAt: new Date('2024-01-02') });
		const remote = makeNote({ title: 'Remote', updatedAt: new Date('2024-01-01') });

		const result = mergeNotes(local, remote);
		expect(result.title).toBe('Local');
	});

	it('should prefer higher version when timestamps are equal', () => {
		const ts = new Date('2024-01-01');
		const local = makeNote({ title: 'Local', updatedAt: ts, version: 1 });
		const remote = makeNote({ title: 'Remote', updatedAt: ts, version: 2 });

		const result = mergeNotes(local, remote);
		expect(result.title).toBe('Remote');
	});

	it('should prefer local when timestamps and versions are equal', () => {
		const ts = new Date('2024-01-01');
		const local = makeNote({ title: 'Local', updatedAt: ts, version: 1 });
		const remote = makeNote({ title: 'Remote', updatedAt: ts, version: 1 });

		const result = mergeNotes(local, remote);
		expect(result.title).toBe('Local');
	});

	it('should preserve pending local fields when remote is newer', () => {
		const local = makeNote({
			title: 'Local title',
			content: 'Local content',
			color: 'coral',
			updatedAt: new Date('2024-01-01'),
			version: 1
		});
		const remote = makeNote({
			title: 'Remote title',
			content: 'Remote content',
			color: 'default',
			updatedAt: new Date('2024-01-02'),
			version: 2
		});

		// Content has pending local changes; title and color do not
		const pendingFields = new Set(['content']);
		const result = mergeNotes(local, remote, pendingFields);

		// Remote wins overall, but content is preserved from local
		expect(result.title).toBe('Remote title');
		expect(result.content).toBe('Local content');
		expect(result.color).toBe('default'); // remote wins for non-pending field
		expect(result.version).toBe(2); // metadata from remote
	});

	it('should take remote values for non-pending fields when remote is newer', () => {
		const local = makeNote({
			pinned: true,
			archived: true,
			updatedAt: new Date('2024-01-01')
		});
		const remote = makeNote({
			pinned: false,
			archived: false,
			updatedAt: new Date('2024-01-02')
		});

		const pendingFields = new Set(['pinned']);
		const result = mergeNotes(local, remote, pendingFields);

		expect(result.pinned).toBe(true); // pending — preserved
		expect(result.archived).toBe(false); // not pending — remote wins
	});

	it('should ignore pendingFields when local is newer', () => {
		const local = makeNote({
			title: 'Local',
			updatedAt: new Date('2024-01-02'),
			version: 2
		});
		const remote = makeNote({
			title: 'Remote',
			updatedAt: new Date('2024-01-01'),
			version: 1
		});

		const pendingFields = new Set(['title']);
		const result = mergeNotes(local, remote, pendingFields);

		// Local wins entirely since it's newer
		expect(result.title).toBe('Local');
	});
});

describe('hasChanges', () => {
	it('should detect title change', () => {
		const a = makeNote({ title: 'A' });
		const b = makeNote({ title: 'B' });
		expect(hasChanges(a, b)).toBe(true);
	});

	it('should detect content change', () => {
		const a = makeNote({ content: 'old' });
		const b = makeNote({ content: 'new' });
		expect(hasChanges(a, b)).toBe(true);
	});

	it('should detect color change', () => {
		const a = makeNote({ color: 'default' });
		const b = makeNote({ color: 'coral' });
		expect(hasChanges(a, b)).toBe(true);
	});

	it('should detect pinned change', () => {
		const a = makeNote({ pinned: false });
		const b = makeNote({ pinned: true });
		expect(hasChanges(a, b)).toBe(true);
	});

	it('should return false when notes are identical', () => {
		const a = makeNote();
		const b = makeNote();
		expect(hasChanges(a, b)).toBe(false);
	});
});

describe('diffNotes', () => {
	it('should return only changed fields', () => {
		const old = makeNote({ title: 'Old', content: 'Same' });
		const updated = makeNote({ title: 'New', content: 'Same' });

		const diff = diffNotes(old, updated);
		expect(diff.title).toBe('New');
		expect(diff.content).toBeUndefined();
	});

	it('should return empty object when no changes', () => {
		const a = makeNote();
		const b = makeNote();

		const diff = diffNotes(a, b);
		expect(Object.keys(diff)).toHaveLength(0);
	});

	it('should track multiple changed fields', () => {
		const old = makeNote({ title: 'Old', color: 'default', pinned: false });
		const updated = makeNote({ title: 'New', color: 'coral', pinned: true });

		const diff = diffNotes(old, updated);
		expect(diff.title).toBe('New');
		expect(diff.color).toBe('coral');
		expect(diff.pinned).toBe(true);
	});
});
