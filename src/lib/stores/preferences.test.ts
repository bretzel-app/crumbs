import { describe, it, expect } from 'vitest';
import { DEFAULT_PREFERENCES, BOOLEAN_PREF_KEYS } from '$lib/types/preferences.js';

describe('preferences defaults', () => {
	it('should have correct default values', () => {
		expect(DEFAULT_PREFERENCES).toEqual({
			defaultNoteMode: 'richtext',
			defaultNoteColor: 'default',
			hideFooter: false,
			sidebarDefaultState: 'open',
			notifyOnShare: true,
			notifyOnCollabRemoved: true,
			notifyOnNoteDeleted: true
		});
	});

	it('should identify boolean preference keys', () => {
		expect(BOOLEAN_PREF_KEYS.has('hideFooter')).toBe(true);
		expect(BOOLEAN_PREF_KEYS.has('notifyOnShare')).toBe(true);
		expect(BOOLEAN_PREF_KEYS.has('notifyOnCollabRemoved')).toBe(true);
		expect(BOOLEAN_PREF_KEYS.has('notifyOnNoteDeleted')).toBe(true);
		expect(BOOLEAN_PREF_KEYS.has('defaultNoteMode')).toBe(false);
		expect(BOOLEAN_PREF_KEYS.has('defaultNoteColor')).toBe(false);
		expect(BOOLEAN_PREF_KEYS.has('sidebarDefaultState')).toBe(false);
	});
});
