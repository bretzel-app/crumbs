<script lang="ts">
	import { notes, loadNotes, currentFilter } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';
	import Icon from '@iconify/svelte';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	let query = $state('');
	let originalNotes: Note[] = [];
	let isSearching = $state(false);
	let inputEl: HTMLInputElement | undefined = $state();

	$effect(() => {
		if (onClose) inputEl?.focus();
	});

	async function handleSearch() {
		if (!query.trim()) {
			if (isSearching) {
				notes.set(originalNotes);
				isSearching = false;
			}
			return;
		}

		if (!isSearching) {
			notes.subscribe((n) => (originalNotes = n))();
			isSearching = true;
		}

		const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
		if (res.ok) {
			const results = await res.json();
			notes.set(results);
		}
	}

	function clearSearch() {
		query = '';
		if (isSearching) {
			notes.set(originalNotes);
			isSearching = false;
		}
	}

	function close() {
		clearSearch();
		onClose?.();
	}
</script>

<div class="relative flex-1 max-w-2xl">
	<div class="flex items-center rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-2 focus-within:border-[var(--primary)]">
		{#if onClose}
			<button onclick={close} class="mr-2 text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Back">
				<Icon icon="pixelarticons:arrow-left" class="h-5 w-5" />
			</button>
		{:else}
			<Icon icon="pixelarticons:search" class="mr-3 h-5 w-5 text-[var(--text-muted)]" />
		{/if}
		<input
			bind:this={inputEl}
			type="text"
			placeholder="Search crumbs..."
			bind:value={query}
			oninput={handleSearch}
			class="w-full bg-transparent text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
			data-testid="search-input"
		/>
		{#if query}
			<button onclick={clearSearch} class="ml-2 text-[var(--text-muted)] hover:text-[var(--text)]" aria-label="Clear search">
				<Icon icon="pixelarticons:close" class="h-5 w-5" />
			</button>
		{/if}
	</div>
</div>
