// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { Table } from './Table.js';
import { renderMarkdown } from '$lib/utils/markdown.js';

function createEditor(content: string | object, markdownOptions?: { html?: boolean }) {
	return new Editor({
		extensions: [
			StarterKit,
			Table.configure({ resizable: false }),
			TableRow,
			TableHeader,
			TableCell,
			Markdown.configure(markdownOptions ?? {})
		],
		content
	});
}

function getMarkdown(editor: Editor): string {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return (editor.storage as Record<string, any>).markdown.getMarkdown();
}

function docWithListInCell(): JSONContent {
	return {
		type: 'doc',
		content: [
			{
				type: 'table',
				content: [
					{
						type: 'tableRow',
						content: [
							{
								type: 'tableHeader',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header A' }] }]
							},
							{
								type: 'tableHeader',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Header B' }] }]
							}
						]
					},
					{
						type: 'tableRow',
						content: [
							{
								type: 'tableCell',
								content: [
									{
										type: 'bulletList',
										content: [
											{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First' }] }] },
											{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Second' }] }] }
										]
									}
								]
							},
							{
								type: 'tableCell',
								content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain cell' }] }]
							}
						]
					}
				]
			}
		]
	};
}

// crumbs#83: a bulleted list inside a table cell survives in the live editor
// (never touches markdown) but breaks once the note is saved and reopened,
// because saving/reopening round-trips the doc through markdown text.
describe('Table markdown round-trip with a bullet list in a cell', () => {
	it('preserves a bullet list inside a table cell after saving and reopening', () => {
		const editor = createEditor(docWithListInCell());

		// "Save": serialize the crumb to markdown, the way onUpdate() does.
		const savedMarkdown = getMarkdown(editor);

		// "Reopen": load that markdown into a fresh editor, the way opening the
		// crumb again does (content is passed in as a markdown string).
		const reopened = createEditor(savedMarkdown);
		const json = reopened.getJSON() as JSONContent;

		const table = json.content?.find((node) => node.type === 'table');
		expect(table).toBeDefined();

		const rows = table!.content!;
		expect(rows).toHaveLength(2);

		const [headerRow, bodyRow] = rows;
		expect(headerRow.content!.map((cell) => cell.content?.[0]?.content?.[0]?.text)).toEqual(['Header A', 'Header B']);

		const [listCell, plainCell] = bodyRow.content!;
		expect(listCell.content?.[0]?.type).toBe('bulletList');
		const items = listCell.content?.[0]?.content ?? [];
		expect(items.map((item) => item.content?.[0]?.content?.[0]?.text)).toEqual(['First', 'Second']);

		expect(plainCell.content?.[0]?.content?.[0]?.text).toBe('Plain cell');
	});

	it('still renders as a real table (not escaped HTML) on the read-only preview/share path', () => {
		const editor = createEditor(docWithListInCell());
		const savedMarkdown = getMarkdown(editor);

		const html = renderMarkdown(savedMarkdown);

		expect(html).toContain('<table>');
		expect(html).toContain('<ul');
		expect(html).toContain('First');
		expect(html).toContain('Second');
		expect(html).not.toContain('&lt;table&gt;');
	});

	it('still serializes a table with only plain-text cells as GFM markdown, not HTML', () => {
		const editor = createEditor({
			type: 'doc',
			content: [
				{
					type: 'table',
					content: [
						{
							type: 'tableRow',
							content: [
								{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'A' }] }] },
								{ type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'B' }] }] }
							]
						},
						{
							type: 'tableRow',
							content: [
								{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1' }] }] },
								{ type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '2' }] }] }
							]
						}
					]
				}
			]
		});

		const savedMarkdown = getMarkdown(editor);

		expect(savedMarkdown).not.toContain('<table');
		expect(savedMarkdown).toContain('| A | B |');
		expect(savedMarkdown).toContain('| 1 | 2 |');
	});

	it('falls back to a placeholder instead of raw HTML when the editor has html mode disabled', () => {
		const editor = createEditor(docWithListInCell(), { html: false });

		const savedMarkdown = getMarkdown(editor);

		expect(savedMarkdown).not.toContain('<table');
		expect(savedMarkdown).toContain('[table]');
	});
});
