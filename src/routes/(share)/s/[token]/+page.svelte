<script lang="ts">
	import { getNoteColor } from '$lib/utils/colors.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import { linkifyText } from '$lib/utils/checklist.js';
	import type { NoteColor, PublicAttachment } from '$lib/types/index.js';

	interface ChecklistItem {
		text: string;
		checked: boolean;
		indented: boolean;
	}

	const { data } = $props();

	// Both palettes are emitted as custom properties so the card follows the visitor's theme on the
	// first paint — the CSS variables in app.css switch on [data-theme], which app.html sets before
	// hydration, so a JS-resolved single colour would flash the wrong palette on this SSR page.
	const noteColor = data.color as NoteColor;
	const bgLight = getNoteColor(noteColor, false);
	const bgDark = getNoteColor(noteColor, true);

	const renderedContent = renderMarkdown(data.content);

	const checklistItems: ChecklistItem[] = data.checklistMode
		? data.content
				.split('\n')
				.filter((l: string) => l.trim())
				.map((line: string) => {
					const indented = line.startsWith('  - [');
					return {
						text: line.replace(/^ {0,2}- \[[ x]\] /, ''),
						checked: /^ {0,2}- \[x\] /.test(line),
						indented
					};
				})
		: [];

	const activeChecklistItems = checklistItems.filter((i) => !i.checked);
	const doneChecklistItems = checklistItems.filter((i) => i.checked);
	const sortedChecklistItems = [...activeChecklistItems, ...doneChecklistItems];

	const imageAttachments = (data.attachments as PublicAttachment[]).filter((a) =>
		a.mimeType.startsWith('image/')
	);

	function formatDate(date: Date | string) {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head>
	<title>{data.title || 'Shared Note'} — Crumbs</title>
	<meta name="description" content={data.content.slice(0, 160)} />
</svelte:head>

<div class="mx-4 w-full max-w-2xl py-10">
	<article
		class="note-surface rounded-sm border border-[var(--border-subtle)] shadow-[var(--card-shadow)] overflow-hidden"
		style="--note-bg: {bgLight}; --note-bg-dark: {bgDark}"
		data-testid="shared-note"
	>
		<div class="px-6 py-5">
			{#if data.title}
				<h1 class="mb-4 text-xl font-semibold text-[var(--text)]" data-testid="shared-note-title">
					{data.title}
				</h1>
			{/if}

			{#if data.checklistMode && checklistItems.length > 0}
				<ul class="space-y-2" data-testid="shared-note-checklist">
					{#each sortedChecklistItems as item}
						<li
							class="flex items-start gap-2 text-sm {item.indented ? 'pl-4 ' : ''}{item.checked
								? 'text-[var(--text-muted)] line-through'
								: 'text-[var(--text)]'}"
							data-testid={item.indented ? 'shared-checklist-child' : undefined}
						>
							<input
								type="checkbox"
								checked={item.checked}
								disabled
								class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--border-subtle)]"
							/>
							<span class="break-words min-w-0">{@html linkifyText(item.text)}</span>
						</li>
					{/each}
				</ul>
			{:else if data.content}
				<div
					class="prose prose-sm max-w-none text-[var(--text)]"
					data-testid="shared-note-content"
				>
					{@html renderedContent}
				</div>
			{/if}

			{#if imageAttachments.length > 0}
				<div class="mt-4 grid grid-cols-2 gap-2" data-testid="shared-note-images">
					{#each imageAttachments as attachment}
						<img
							src="/api/shared/{data.token}/attachment/{attachment.id}"
							alt={attachment.filename}
							class="w-full rounded-sm border border-[var(--border-subtle)]"
							loading="lazy"
						/>
					{/each}
				</div>
			{/if}
		</div>

		<div
			class="flex items-center justify-between border-t border-[var(--border-subtle)] px-6 py-3"
		>
			<span class="text-xs text-[var(--text-muted)]">
				{formatDate(data.updatedAt)}
			</span>
		</div>
	</article>

	<div class="mt-6 text-center">
		<a
			href="https://crumbs.bretzel.app"
			target="_blank"
			rel="noopener noreferrer"
			class="font-['Press_Start_2P'] text-[8px] tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
		>
			POWERED BY CRUMBS
		</a>
	</div>
</div>

<style>
	.note-surface {
		background-color: var(--note-bg);
	}

	:global([data-theme='dark']) .note-surface {
		background-color: var(--note-bg-dark);
	}
</style>
