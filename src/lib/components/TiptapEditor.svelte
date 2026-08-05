<script lang="ts">
	import { onMount } from 'svelte';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import Link from '@tiptap/extension-link';
	import Underline from '@tiptap/extension-underline';
	import TextAlign from '@tiptap/extension-text-align';
	import Placeholder from '@tiptap/extension-placeholder';
	import { Table } from '@tiptap/extension-table';
	import { TableRow } from '@tiptap/extension-table-row';
	import { TableHeader } from '@tiptap/extension-table-header';
	import { TableCell } from '@tiptap/extension-table-cell';
	import TaskList from '@tiptap/extension-task-list';
	import TaskItem from '@tiptap/extension-task-item';
	import { Markdown } from 'tiptap-markdown';
	import { NoteLink } from './tiptap/NoteLink.js';
	import { getAllNotes } from '$lib/sync/idb.js';

	interface Props {
		content: string;
		onUpdate: (markdown: string) => void;
		onEditor?: (editor: Editor) => void;
		onTransaction?: () => void;
		onOpenNote?: (noteId: string) => void;
		placeholder?: string;
	}

	let { content, onUpdate, onEditor, onTransaction, onOpenNote, placeholder = 'Add a crumb...' }: Props = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();

	const titleIndexRef = { index: new Map<string, string>() };

	function isTaskCheckboxTarget(target: EventTarget | null): boolean {
		if (target instanceof Element) {
			const checkbox = target.matches('input[type="checkbox"]')
				? target
				: target.closest('label')?.querySelector('input[type="checkbox"]');
			return checkbox !== null && checkbox !== undefined;
		}
		return false;
	}

	function isTouchDevice(): boolean {
		return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
	}

	function handleWrapperPointerDown(event: PointerEvent) {
		if (event.pointerType === 'touch' && isTaskCheckboxTarget(event.target)) {
			event.preventDefault();
		}
	}

	function handleWrapperClick(event: MouseEvent) {
		if (isTaskCheckboxTarget(event.target)) {
			return;
		}

		editor?.commands.focus();
	}

	function handleWrapperChangeCapture(event: Event) {
		if (!isTouchDevice() || !(event.target instanceof HTMLInputElement)) return;
		if (event.target.type !== 'checkbox' || !editor) return;

		const taskItem = event.target.closest('li[data-checked]');
		if (!taskItem) return;

		const taskItemPosition = editor.view.posAtDOM(taskItem, 0) - 1;
		const taskItemNode = editor.state.doc.nodeAt(taskItemPosition);
		if (taskItemNode?.type.name !== 'taskItem') return;

		event.stopPropagation();
		editor.view.dispatch(
			editor.state.tr.setNodeMarkup(taskItemPosition, undefined, {
				...taskItemNode.attrs,
				checked: event.target.checked
			})
		);
	}

	onMount(() => {
		let destroyed = false;
		let editorInstance: Editor | undefined;

		(async () => {
			const allNotes = await getAllNotes();
			if (destroyed) return;
			titleIndexRef.index = new Map(allNotes.filter((n) => !n.trashed).map((n) => [n.id, n.title]));

			editorInstance = new Editor({
				element: element!,
				extensions: [
					StarterKit.configure({ link: false, underline: false }),
					Link.configure({ openOnClick: false }),
					Underline,
					TextAlign.configure({ types: ['heading', 'paragraph'] }),
					Placeholder.configure({ placeholder }),
					Table.configure({ resizable: false }),
					TableRow,
					TableHeader,
					TableCell,
					TaskList,
					TaskItem.configure({ nested: true }),
					NoteLink.configure({ titleIndexRef, onOpenNote: onOpenNote ?? (() => {}) }),
					Markdown
				],
				content,
				onUpdate: ({ editor: e }) => {
					if (destroyed) return;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					onUpdate((e.storage as Record<string, any>).markdown.getMarkdown());
				},
				onTransaction: () => {
					// Removing this component's DOM node (e.g. a {#key}-driven remount
					// in NotesView.svelte when switching to a different note) fires a
					// native blur on the still-focused contenteditable, which
					// ProseMirror's blur plugin turns into one last transaction —
					// synchronously, from inside Svelte's own render/effect pass that's
					// doing the removal. Mutating $state right there crashes with
					// state_unsafe_mutation; the `destroyed` check alone isn't enough
					// since this can fire before onMount's own cleanup runs. Defer to a
					// microtask so the write lands after Svelte's current pass finishes.
					queueMicrotask(() => {
						if (destroyed) return;
						editor = editorInstance;
						onTransaction?.();
					});
				}
			});
			editor = editorInstance;

			if (element && !destroyed) {
				(element as any).__tiptapEditor = editorInstance;
			}

			onEditor?.(editorInstance);
		})();

		return () => {
			destroyed = true;
			editorInstance?.destroy();
		};
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<div
	bind:this={element}
	class="tiptap-wrapper prose md:prose-sm flex min-h-[300px] max-w-none flex-col px-4 py-2 text-[var(--text)]"
	data-testid="tiptap-editor"
	role="textbox"
	aria-multiline="true"
	tabindex="0"
	onpointerdown={handleWrapperPointerDown}
	onclick={handleWrapperClick}
	onchangecapture={handleWrapperChangeCapture}
></div>

<style>
	.tiptap-wrapper :global(.tiptap) {
		outline: none;
		flex: 1;
	}

	.tiptap-wrapper :global(.tiptap p.is-editor-empty:first-child::before) {
		content: attr(data-placeholder);
		float: left;
		color: var(--text-muted);
		pointer-events: none;
		height: 0;
	}
</style>
