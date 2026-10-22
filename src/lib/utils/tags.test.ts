import { describe, it, expect } from 'vitest';
import { extractTags, isTagName } from './tags.js';

describe('extractTags', () => {
	it('should extract simple hashtags', () => {
		expect(extractTags('Hello #world')).toEqual(['world']);
	});

	it('should extract multiple hashtags', () => {
		expect(extractTags('#work #personal #todo')).toEqual(['work', 'personal', 'todo']);
	});

	it('should deduplicate tags', () => {
		expect(extractTags('#work some text #work')).toEqual(['work']);
	});

	it('should lowercase tags', () => {
		expect(extractTags('#Work #IMPORTANT')).toEqual(['work', 'important']);
	});

	it('should handle tags with hyphens', () => {
		expect(extractTags('#my-project')).toEqual(['my-project']);
	});

	it('should handle tags with underscores', () => {
		expect(extractTags('#my_project')).toEqual(['my_project']);
	});

	it('should return empty array for no tags', () => {
		expect(extractTags('No hashtags here')).toEqual([]);
	});

	it('should return empty array for empty string', () => {
		expect(extractTags('')).toEqual([]);
	});

	it('should not match hashtags inside code blocks', () => {
		expect(extractTags('```\n#not-a-tag\n```')).toEqual([]);
	});

	it('should not match hashtags inside inline code', () => {
		expect(extractTags('Use `#channel` for that')).toEqual([]);
	});

	it('should not match hashtags in URLs', () => {
		expect(extractTags('Visit https://example.com#section')).toEqual([]);
	});

	it('should handle tags at start of line', () => {
		expect(extractTags('#first tag')).toEqual(['first']);
	});

	it('should handle mixed content with code and tags', () => {
		const content = 'My #project uses `#define` and has a #deadline';
		expect(extractTags(content)).toEqual(['project', 'deadline']);
	});
});

describe('isTagName', () => {
	it('accepts a name extractTags could have produced', () => {
		expect(isTagName('network')).toBe(true);
		expect(isTagName('to-do_2')).toBe(true);
	});

	it('rejects names no hashtag can produce', () => {
		expect(isTagName('')).toBe(false);
		expect(isTagName('Network')).toBe(false);
		expect(isTagName('two words')).toBe(false);
		expect(isTagName('#network')).toBe(false);
	});
});
