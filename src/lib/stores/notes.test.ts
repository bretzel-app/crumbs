import { describe, it, expect } from 'vitest';
import { mergeNotesByVersion, reconcileSearchResults } from './notes.js';
import type { Note } from '$lib/types/index.js';

function makeNote(overrides: Partial<Note> = {}): Note {
	return {
		id: 'note-1',
		title: 'Test',
		content: '- [ ] Item',
		color: 'default',
		pinned: false,
		archived: false,
		trashed: false,
		trashedAt: null,
		checklistMode: true,
		sortOrder: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
		version: 1,
		tags: [],
		attachments: [],
		collaborators: [],
		isOwner: true,
		isShared: false,
		...overrides
	};
}

describe('mergeNotesByVersion', () => {
	it('keeps the local note when it has a higher version than the incoming note', () => {
		const local = makeNote({ id: 'n1', version: 3, content: '- [x] Checked' });
		const incoming = makeNote({ id: 'n1', version: 2, content: '- [ ] Unchecked' });

		const result = mergeNotesByVersion([local], [incoming]);

		expect(result).toHaveLength(1);
		expect(result[0].content).toBe('- [x] Checked');
		expect(result[0].version).toBe(3);
	});

	it('uses the incoming note when it has a higher or equal version', () => {
		const local = makeNote({ id: 'n1', version: 2, content: '- [ ] Old' });
		const incoming = makeNote({ id: 'n1', version: 3, content: '- [x] New' });

		const result = mergeNotesByVersion([local], [incoming]);

		expect(result).toHaveLength(1);
		expect(result[0].content).toBe('- [x] New');
		expect(result[0].version).toBe(3);
	});

	it('uses the incoming note when versions are equal', () => {
		const local = makeNote({ id: 'n1', version: 2, content: 'local' });
		const incoming = makeNote({ id: 'n1', version: 2, content: 'incoming' });

		const result = mergeNotesByVersion([local], [incoming]);

		expect(result[0].content).toBe('incoming');
	});

	it('handles notes not present in the local store', () => {
		const incoming = makeNote({ id: 'n2', version: 1 });

		const result = mergeNotesByVersion([], [incoming]);

		expect(result).toHaveLength(1);
		expect(result[0].id).toBe('n2');
	});

	it('preserves local-only notes not present in the incoming data', () => {
		const localOnly = makeNote({ id: 'n1', version: 1, content: 'just created' });
		const serverNote = makeNote({ id: 'n2', version: 1, content: 'from server' });

		const result = mergeNotesByVersion([localOnly], [serverNote]);

		expect(result).toHaveLength(2);
		expect(result.find((n) => n.id === 'n1')?.content).toBe('just created');
		expect(result.find((n) => n.id === 'n2')?.content).toBe('from server');
	});

	it('preserves multiple notes correctly during a race condition', () => {
		const localNotes = [
			makeNote({ id: 'n1', version: 5, content: '- [x] Just saved' }),
			makeNote({ id: 'n2', version: 1, content: 'unchanged' })
		];
		const incomingNotes = [
			makeNote({ id: 'n1', version: 4, content: '- [ ] Stale from server' }),
			makeNote({ id: 'n2', version: 2, content: 'updated on server' })
		];

		const result = mergeNotesByVersion(localNotes, incomingNotes);

		expect(result).toHaveLength(2);
		// n1: local version 5 > incoming version 4 → keep local
		expect(result[0].content).toBe('- [x] Just saved');
		// n2: local version 1 < incoming version 2 → use incoming
		expect(result[1].content).toBe('updated on server');
	});
});

describe('reconcileSearchResults', () => {
	it('updates existing results and removes notes absent from canonical state', () => {
		const updated = makeNote({ id: 'n1', title: 'Updated', version: 2 });
		const removed = makeNote({ id: 'n2', title: 'Removed' });

		const result = reconcileSearchResults([updated], [
			makeNote({ id: 'n1', title: 'Stale', version: 1 }),
			removed
		]);

		expect(result).toEqual([updated]);
	});
});
