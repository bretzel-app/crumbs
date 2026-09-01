import { elementFromString, getHTMLFromFragment } from '@tiptap/core';
import { Table as BaseTable } from '@tiptap/extension-table';
import { Fragment, type Node as ProseMirrorNode } from '@tiptap/pm/model';

interface MarkdownSerializerState {
	write(text: string): void;
	ensureNewLine(): void;
	closeBlock(node: ProseMirrorNode): void;
	renderInline(node: ProseMirrorNode): void;
	inTable: boolean;
}

interface SerializeContext {
	editor: { storage: { markdown: { options: { html: boolean } } } };
}

function childNodes(node: ProseMirrorNode): ProseMirrorNode[] {
	const nodes: ProseMirrorNode[] = [];
	node.forEach((child) => nodes.push(child));
	return nodes;
}

function hasSpan(cell: ProseMirrorNode): boolean {
	return cell.attrs.colspan > 1 || cell.attrs.rowspan > 1;
}

/**
 * A cell can only be squeezed onto a single `| cell |` markdown line via
 * `state.renderInline()` if its content is itself a textblock (a paragraph,
 * whose children are inline text runs). A block child instead - e.g. a
 * bullet list - has to be rejected here, or renderInline() misreads its
 * block-level children as inline ones and corrupts the row (crumbs#83).
 */
function hasOnlyInlineContent(cell: ProseMirrorNode): boolean {
	const content = cell.firstChild;
	return content === null || content.type.isTextblock;
}

function isMarkdownSerializable(node: ProseMirrorNode): boolean {
	const rows = childNodes(node);
	const firstRow = rows[0];
	const bodyRows = rows.slice(1);

	if (
		childNodes(firstRow).some(
			(cell) => cell.type.name !== 'tableHeader' || hasSpan(cell) || cell.childCount > 1 || !hasOnlyInlineContent(cell)
		)
	) {
		return false;
	}

	return !bodyRows.some((row) =>
		childNodes(row).some(
			(cell) => cell.type.name === 'tableHeader' || hasSpan(cell) || cell.childCount > 1 || !hasOnlyInlineContent(cell)
		)
	);
}

/** Mirrors tiptap-markdown's internal HTML-block fallback (its HTMLNode spec isn't exported). */
function formatBlock(html: string): string {
	const element = elementFromString(html).firstElementChild!;
	element.innerHTML = element.innerHTML.trim() ? `\n${element.innerHTML}\n` : '\n';
	return element.outerHTML;
}

/**
 * Same as tiptap-markdown's HTMLNode fallback: when the editor's `html`
 * option is off, other node types degrade to a `[nodename]` placeholder
 * instead of emitting HTML. A table with non-inline cell content has to
 * follow the same rule, or it'd be the only node type still leaking raw HTML
 * with html mode disabled.
 */
function serializeAsHTML(
	context: SerializeContext,
	state: MarkdownSerializerState,
	node: ProseMirrorNode,
	parent: ProseMirrorNode | Fragment
) {
	if (!context.editor.storage.markdown.options.html) {
		state.write(`[${node.type.name}]`);
		state.closeBlock(node);
		return;
	}

	const schema = node.type.schema;
	const html = getHTMLFromFragment(Fragment.from(node), schema);
	const isTopLevel = parent instanceof Fragment || parent.type.name === schema.topNodeType.name;
	state.write(isTopLevel ? formatBlock(html) : html);
	state.closeBlock(node);
}

/**
 * Overrides @tiptap/extension-table's markdown storage (tiptap-markdown ships
 * a default for it, but only guards against multi-child/spanning cells, not
 * a single block child - see hasOnlyInlineContent above).
 */
export const Table = BaseTable.extend({
	addStorage() {
		return {
			markdown: {
				serialize(
					this: SerializeContext,
					state: MarkdownSerializerState,
					node: ProseMirrorNode,
					parent: ProseMirrorNode | Fragment
				) {
					if (!isMarkdownSerializable(node)) {
						serializeAsHTML(this, state, node, parent);
						return;
					}

					state.inTable = true;
					node.forEach((row, _rowOffset, rowIndex) => {
						state.write('| ');
						row.forEach((cell, _cellOffset, cellIndex) => {
							if (cellIndex) {
								state.write(' | ');
							}
							const cellContent = cell.firstChild;
							if (cellContent && cellContent.textContent.trim()) {
								state.renderInline(cellContent);
							}
						});
						state.write(' |');
						state.ensureNewLine();
						if (!rowIndex) {
							const delimiterRow = Array.from({ length: row.childCount }, () => '---').join(' | ');
							state.write(`| ${delimiterRow} |`);
							state.ensureNewLine();
						}
					});
					state.closeBlock(node);
					state.inTable = false;
				},
				parse: {
					// handled by markdown-it, same as tiptap-markdown's default table spec
				}
			}
		};
	}
});
