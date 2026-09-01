// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Markdown } from 'tiptap-markdown';
import { Table } from './Table.js';

// crumbs#83: a bulleted list inside a table cell survives in the live editor
// (never touches markdown) but breaks once the note is saved and reopened,
// because saving/reopening round-trips the doc through markdown text.
describe('Table markdown round-trip with a bullet list in a cell', () => {
	function createEditor(content: string | object) {
		return new Editor({
			extensions: [StarterKit, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell, Markdown],
			content
		});
	}

	it('preserves a bullet list inside a table cell after saving and reopening', () => {
		const editor = createEditor({
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
		});

		// "Save": serialize the crumb to markdown, the way onUpdate() does.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const savedMarkdown = (editor.storage as Record<string, any>).markdown.getMarkdown();

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
});
