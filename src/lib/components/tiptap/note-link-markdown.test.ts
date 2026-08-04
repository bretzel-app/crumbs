import { describe, it, expect } from 'vitest';
import { parseNoteLinkHref, serializeNoteLinkMarkdown } from './note-link-markdown.js';

describe('parseNoteLinkHref', () => {
	it('should extract the note ID from a crumb-note:// href', () => {
		expect(parseNoteLinkHref('crumb-note://abc-123')).toBe('abc-123');
	});

	it('should return null for a non-crumb-note href', () => {
		expect(parseNoteLinkHref('https://example.com')).toBeNull();
	});

	it('should return null for an empty string', () => {
		expect(parseNoteLinkHref('')).toBeNull();
	});
});

describe('serializeNoteLinkMarkdown', () => {
	it('should produce a markdown link with the title from the index', () => {
		const titleIndex = new Map([['abc-123', 'Grocery List']]);
		expect(serializeNoteLinkMarkdown('abc-123', titleIndex)).toBe('[Grocery List](crumb-note://abc-123)');
	});

	it('should fall back to Untitled when the ID is not in the index', () => {
		const titleIndex = new Map<string, string>();
		expect(serializeNoteLinkMarkdown('missing-id', titleIndex)).toBe('[Untitled](crumb-note://missing-id)');
	});

	it('should escape markdown-special characters in the title', () => {
		const titleIndex = new Map([['id-1', 'Buy [milk] today']]);
		expect(serializeNoteLinkMarkdown('id-1', titleIndex)).toBe('[Buy \\[milk\\] today](crumb-note://id-1)');
	});
});
