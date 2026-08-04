import { Node, mergeAttributes } from '@tiptap/core';
import { parseNoteLinkHref, serializeNoteLinkMarkdown } from './note-link-markdown.js';

export interface NoteLinkOptions {
	titleIndexRef: { index: Map<string, string> };
	onOpenNote: (noteId: string) => void;
}

export const NoteLink = Node.create<NoteLinkOptions>({
	name: 'noteLink',
	group: 'inline',
	inline: true,
	atom: true,

	addOptions() {
		return {
			titleIndexRef: { index: new Map<string, string>() },
			onOpenNote: () => {}
		};
	},

	addAttributes() {
		return {
			noteId: {
				default: null,
				parseHTML: (element) => element.getAttribute('data-note-id'),
				renderHTML: (attributes) => ({ 'data-note-id': attributes.noteId })
			}
		};
	},

	parseHTML() {
		return [
			{
				tag: 'a[href^="crumb-note://"]',
				priority: 100,
				getAttrs: (element) => {
					const href = (element as HTMLElement).getAttribute('href') ?? '';
					const noteId = parseNoteLinkHref(href);
					return noteId ? { noteId } : false;
				}
			}
		];
	},

	renderHTML({ HTMLAttributes }) {
		return ['a', mergeAttributes(HTMLAttributes, { href: `crumb-note://${HTMLAttributes['data-note-id']}` })];
	},

	addStorage() {
		return {
			markdown: {
				serialize: (state: { write: (s: string) => void }, node: { attrs: { noteId: string } }) => {
					state.write(serializeNoteLinkMarkdown(node.attrs.noteId, this.options.titleIndexRef.index));
				}
			}
		};
	},

	addNodeView() {
		return ({ node, editor, getPos }) => {
			const noteId = node.attrs.noteId as string;
			const title = this.options.titleIndexRef.index.get(noteId);

			const dom = document.createElement('span');
			dom.setAttribute('data-note-id', noteId);
			dom.className =
				'group relative inline-flex items-center gap-1 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-1.5 py-0.5 text-sm';

			const label = document.createElement('span');
			if (title !== undefined) {
				label.textContent = title;
				label.className = 'cursor-pointer text-[var(--primary)] hover:text-[var(--primary-hover)]';
				label.addEventListener('click', (event) => {
					event.preventDefault();
					this.options.onOpenNote(noteId);
				});
			} else {
				label.textContent = 'Note not found';
				label.className = 'text-[var(--text-muted)] opacity-60';
			}
			dom.appendChild(label);

			const removeButton = document.createElement('button');
			removeButton.type = 'button';
			removeButton.textContent = '×';
			removeButton.setAttribute('aria-label', 'Remove note link');
			removeButton.className =
				'max-md:opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100 text-[var(--text-muted)] hover:text-[var(--destructive)]';
			removeButton.addEventListener('click', (event) => {
				event.preventDefault();
				const pos = getPos();
				if (pos === undefined) return;
				editor.chain().focus().deleteRange({ from: pos, to: pos + node.nodeSize }).run();
			});
			dom.appendChild(removeButton);

			return { dom };
		};
	}
});
