import { describe, it, expect } from 'vitest';
import { renderMarkdown, stripMarkdown } from './markdown.js';

describe('renderMarkdown', () => {
	it('should render bold text', () => {
		const html = renderMarkdown('**bold**');
		expect(html).toContain('<strong>bold</strong>');
	});

	it('should render italic text', () => {
		const html = renderMarkdown('*italic*');
		expect(html).toContain('<em>italic</em>');
	});

	it('should render headings', () => {
		const html = renderMarkdown('# Heading 1');
		expect(html).toContain('<h1>Heading 1</h1>');
	});

	it('should render unordered lists', () => {
		const html = renderMarkdown('- item 1\n- item 2');
		expect(html).toContain('<li>item 1</li>');
		expect(html).toContain('<li>item 2</li>');
	});

	it('should render ordered lists', () => {
		const html = renderMarkdown('1. first\n2. second');
		expect(html).toContain('<li>first</li>');
		expect(html).toContain('<li>second</li>');
	});

	it('should render code blocks', () => {
		const html = renderMarkdown('```\nconst x = 1;\n```');
		expect(html).toContain('<code>');
		expect(html).toContain('const x = 1;');
	});

	it('should render inline code', () => {
		const html = renderMarkdown('Use `npm install`');
		expect(html).toContain('<code>npm install</code>');
	});

	it('should render links', () => {
		const html = renderMarkdown('[Google](https://google.com)');
		expect(html).toContain('href="https://google.com"');
		expect(html).toContain('Google');
	});

	it('should render tables', () => {
		const md = '| A | B |\n|---|---|\n| 1 | 2 |';
		const html = renderMarkdown(md);
		expect(html).toContain('<table>');
		expect(html).toContain('<td>1</td>');
	});

	it('should auto-linkify URLs', () => {
		const html = renderMarkdown('Visit https://example.com');
		expect(html).toContain('href="https://example.com"');
	});

	it('should convert line breaks', () => {
		const html = renderMarkdown('line 1\nline 2');
		expect(html).toContain('<br>');
	});
});

describe('stripMarkdown', () => {
	it('should remove markdown formatting', () => {
		expect(stripMarkdown('**bold** and *italic*')).toBe('bold and italic');
	});

	it('should remove code blocks', () => {
		expect(stripMarkdown('```\ncode\n```')).toBe('');
	});

	it('should remove inline code backticks', () => {
		expect(stripMarkdown('Use `command`')).toBe('Use');
	});

	it('should extract link text', () => {
		expect(stripMarkdown('[Click here](https://example.com)')).toBe('Click here');
	});

	it('should return empty for empty input', () => {
		expect(stripMarkdown('')).toBe('');
	});
});

describe('renderMarkdown note-link handling', () => {
	it('should render a crumb-note:// link as plain text, not a clickable anchor', () => {
		const html = renderMarkdown('See [Grocery List](crumb-note://abc-123) for details');
		expect(html).not.toContain('<a');
		expect(html).toContain('Grocery List');
	});

	it('should still render a normal external link as a real anchor', () => {
		const html = renderMarkdown('See [Example](https://example.com) for details');
		expect(html).toContain('<a href="https://example.com"');
	});
});
