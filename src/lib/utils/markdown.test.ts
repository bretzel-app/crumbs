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

	it('should render a raw HTML table block (the table-with-a-list-in-a-cell fallback) instead of escaping it', () => {
		// crumbs#83: a bulleted list inside a table cell can't be expressed in
		// plain GFM, so the editor falls back to embedding the whole table as
		// raw HTML in the saved markdown. The preview/share renderer must
		// actually render that block, not show it as literal escaped text.
		const html = renderMarkdown(
			'<table><tbody><tr><td><ul><li>First</li><li>Second</li></ul></td><td>Plain cell</td></tr></tbody></table>'
		);
		expect(html).toContain('<table>');
		expect(html).toContain('<li>First</li>');
		expect(html).toContain('<li>Second</li>');
		expect(html).not.toContain('&lt;table&gt;');
	});

	it('should strip a script tag from raw HTML content', () => {
		// Note content isn't only ever written through the Tiptap editor - the
		// MCP server and the notes API accept a raw markdown string directly,
		// so this renderer can't trust that any HTML it's asked to render is
		// safe just because rendering HTML at all is now allowed.
		const html = renderMarkdown('<p>hello</p><script>alert(1)</script><img src=x onerror="alert(2)">');
		expect(html).not.toContain('<script');
		expect(html).not.toContain('onerror');
		expect(html).toContain('hello');
	});

	it('should still render task-list checkboxes after sanitization', () => {
		const html = renderMarkdown('[ ] todo\n\n[x] done');
		expect(html).toContain('type="checkbox"');
		expect(html).toContain('checked');
		expect(html).toContain('disabled');
		expect(html).toContain('class="task-checkbox"');
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
