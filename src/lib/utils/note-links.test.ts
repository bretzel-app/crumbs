import { describe, it, expect } from 'vitest';
import { extractNoteLinks } from './note-links.js';

describe('extractNoteLinks', () => {
	it('should extract a single note-link reference', () => {
		expect(extractNoteLinks('See [Grocery List](crumb-note://abc-123)')).toEqual(['abc-123']);
	});

	it('should extract multiple distinct references', () => {
		const content = '[A](crumb-note://id-1) and [B](crumb-note://id-2)';
		expect(extractNoteLinks(content)).toEqual(['id-1', 'id-2']);
	});

	it('should deduplicate repeated references', () => {
		const content = '[A](crumb-note://id-1) again: [A again](crumb-note://id-1)';
		expect(extractNoteLinks(content)).toEqual(['id-1']);
	});

	it('should return an empty array for content with no note-links', () => {
		expect(extractNoteLinks('Just [a normal link](https://example.com)')).toEqual([]);
	});

	it('should return an empty array for empty content', () => {
		expect(extractNoteLinks('')).toEqual([]);
	});

	it('should not match crumb-note:// occurring inside a code block', () => {
		const content = '```\n[A](crumb-note://id-1)\n```';
		expect(extractNoteLinks(content)).toEqual([]);
	});

	it('should not match crumb-note:// occurring inside inline code', () => {
		expect(extractNoteLinks('Use `crumb-note://id-1` as an example')).toEqual([]);
	});
});
