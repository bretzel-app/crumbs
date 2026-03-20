<script lang="ts">
	import { COLOR_OPTIONS, getNoteColor } from '$lib/utils/colors.js';
	import { getIsDarkMode } from '$lib/utils/theme.svelte.js';
	import type { NoteColor } from '$lib/types/index.js';

	interface Props {
		selected: NoteColor;
		onSelect: (color: NoteColor) => void;
	}

	let { selected, onSelect }: Props = $props();
</script>

<div class="flex flex-wrap gap-1" data-testid="color-picker">
	{#each COLOR_OPTIONS as option}
		<button
			onclick={() => onSelect(option.value)}
			class="h-8 w-8 rounded-full border-2 transition-transform hover:scale-110 {selected === option.value ? 'border-[var(--text)]' : 'border-[var(--border-subtle)]'}"
			style="background-color: {getNoteColor(option.value, getIsDarkMode())}"
			title={option.label}
			data-testid="color-{option.value}"
		></button>
	{/each}
</div>
