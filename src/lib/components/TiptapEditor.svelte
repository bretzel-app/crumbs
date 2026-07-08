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

	interface Props {
		content: string;
		onUpdate: (markdown: string) => void;
		onEditor?: (editor: Editor) => void;
		onTransaction?: () => void;
		placeholder?: string;
	}

	let { content, onUpdate, onEditor, onTransaction, placeholder = 'Add a crumb...' }: Props = $props();

	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();

	onMount(() => {
		editor = new Editor({
			element: element!,
			extensions: [
				StarterKit,
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
				Markdown
			],
			content,
			onUpdate: ({ editor: e }) => {
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				onUpdate((e.storage as Record<string, any>).markdown.getMarkdown());
			},
			onTransaction: () => {
				// Trigger Svelte reactivity for active state checks
				editor = editor;
				onTransaction?.();
			}
		});

		// Expose editor on DOM element for e2e testing
		if (element) {
			(element as any).__tiptapEditor = editor;
		}

		onEditor?.(editor);

		return () => {
			editor?.destroy();
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
	onclick={() => editor?.commands.focus()}
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
