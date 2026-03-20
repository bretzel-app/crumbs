<script lang="ts">
	import { NOTE_COLORS } from '$lib/utils/colors.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import type { NoteColor, Attachment } from '$lib/types/index.js';

	interface ChecklistItem {
		text: string;
		checked: boolean;
	}

	const { data } = $props();

	const noteColor = data.color as NoteColor;
	const bgColor = NOTE_COLORS[noteColor]?.bg ?? NOTE_COLORS.default.bg;

	const renderedContent = renderMarkdown(data.content);

	const checklistItems: ChecklistItem[] = data.checklistMode
		? data.content
				.split('\n')
				.filter((l: string) => l.trim())
				.map((line: string) => ({
					text: line.replace(/^- \[[ x]\] /, ''),
					checked: line.startsWith('- [x] ')
				}))
		: [];

	const activeChecklistItems = checklistItems.filter((i) => !i.checked);
	const doneChecklistItems = checklistItems.filter((i) => i.checked);
	const sortedChecklistItems = [...activeChecklistItems, ...doneChecklistItems];

	const imageAttachments = (data.attachments as Attachment[]).filter((a) =>
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
		class="rounded-sm border border-[var(--border-subtle)] shadow-[var(--card-shadow)] overflow-hidden"
		style="background-color: {bgColor}"
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
							class="flex items-start gap-2 text-sm {item.checked
								? 'text-[var(--text-muted)] line-through'
								: 'text-[var(--text)]'}"
						>
							<input
								type="checkbox"
								checked={item.checked}
								disabled
								class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--border-subtle)]"
							/>
							<span class="break-words min-w-0">{item.text}</span>
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
			href="https://github.com/bretzel-app/crumbs"
			target="_blank"
			rel="noopener noreferrer"
			class="font-['Press_Start_2P'] text-[8px] tracking-wider text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors"
		>
			POWERED BY CRUMBS
		</a>
	</div>
</div>
