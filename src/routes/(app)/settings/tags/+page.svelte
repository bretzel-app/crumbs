<script lang="ts">
	import ColorPicker from '$lib/components/ColorPicker.svelte';
	import { allTags } from '$lib/stores/notes.js';
	import { getTagColors, setTagColor } from '$lib/stores/tag-colors.svelte.js';
	import { NOTE_COLORS, getNoteChip } from '$lib/utils/colors.js';
	import { getIsDarkMode } from '$lib/utils/theme.svelte.js';
	import type { NoteColor } from '$lib/types/index.js';

	const tagColors = $derived(getTagColors());
	let openTag = $state<string | null>(null);

	function pick(tag: string, color: NoteColor) {
		setTagColor(tag, color === 'default' ? null : color);
		openTag = null;
	}
</script>

<div class="space-y-6">
	<div class="space-y-2">
		<h2 class="text-xl font-bold text-[var(--text)]">Tags</h2>
		<p class="text-sm text-[var(--text-muted)]">
			Notes take the colour of their tag, unless you picked a colour on the note itself. With several
			coloured tags, the first one in the note wins.
		</p>
	</div>

	{#if $allTags.length === 0}
		<p class="text-sm text-[var(--text-muted)]">No tags yet. Write a #hashtag in a note and it shows up here.</p>
	{:else}
		<ul class="divide-y divide-[var(--border-subtle)] rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
			{#each $allTags as tag (tag)}
				{@const color = tagColors[tag] ?? 'default'}
				<li class="px-4 py-3" data-testid="tag-color-row">
					<div class="flex items-center justify-between gap-3">
						<a href="/tag/{tag}" class="truncate text-sm text-[var(--text)] hover:text-[var(--primary)]">#{tag}</a>
						<button
							onclick={() => (openTag = openTag === tag ? null : tag)}
							class="flex shrink-0 items-center gap-2 rounded-sm border px-2 py-1 text-xs transition-colors {openTag === tag ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-subtle)] text-[var(--text)] hover:border-[var(--primary)]'}"
							aria-expanded={openTag === tag}
							aria-label="Colour for #{tag}"
							data-testid="tag-color-toggle"
						>
							<span
								class="h-4 w-4 rounded-full border border-[var(--border-subtle)]"
								style="background-color: {getNoteChip(color, getIsDarkMode())}"
							></span>
							{color === 'default' ? 'No colour' : NOTE_COLORS[color].label}
						</button>
					</div>
					{#if openTag === tag}
						<div class="mt-3">
							<ColorPicker selected={color} onSelect={(c: NoteColor) => pick(tag, c)} />
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>
