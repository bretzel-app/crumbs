<script lang="ts">
	import { searchQuery, searchResults } from '$lib/stores/notes.js';
	import type { Note } from '$lib/types/index.js';
	import Search from 'lucide-svelte/icons/search';
	import X from 'lucide-svelte/icons/x';
	import ArrowLeft from 'lucide-svelte/icons/arrow-left';
	import { onDestroy } from 'svelte';

	interface Props {
		onClose?: () => void;
	}

	let { onClose }: Props = $props();

	let query = $state('');
	let inputEl: HTMLInputElement | undefined = $state();
	let searchController: AbortController | undefined;

	$effect(() => {
		if (onClose) inputEl?.focus();
	});

	onDestroy(() => {
		searchController?.abort();
		searchQuery.set('');
		searchResults.set([]);
	});

	async function handleSearch() {
		searchController?.abort();
		searchController = undefined;

		const trimmedQuery = query.trim();

		if (!trimmedQuery) {
			searchQuery.set('');
			searchResults.set([]);
			return;
		}

		const controller = new AbortController();
		searchController = controller;

		try {
			const res = await fetch(`/api/search?q=${encodeURIComponent(trimmedQuery)}`, {
				signal: controller.signal
			});
			if (res.ok) {
				const results: Note[] = await res.json();
				if (searchController !== controller || query.trim() !== trimmedQuery) return;
				// Commit the query alongside its results so the view switches to the
				// (possibly empty) result set only once it's ready — this avoids
				// flashing an empty state over the current notes while the request is
				// in flight, and keeps searchQuery consistent with searchResults on
				// a failed request (neither updates).
				searchResults.set(results);
				searchQuery.set(trimmedQuery);
			}
		} catch (error) {
			if (!(error instanceof DOMException && error.name === 'AbortError')) {
				console.error('Search failed:', error);
			}
		} finally {
			if (searchController === controller) searchController = undefined;
		}
	}

	function clearSearch() {
		searchController?.abort();
		searchController = undefined;
		query = '';
		searchQuery.set('');
		searchResults.set([]);
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
				<ArrowLeft class="h-5 w-5" />
			</button>
		{:else}
			<Search class="mr-3 h-5 w-5 text-[var(--text-muted)]" />
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
				<X class="h-5 w-5" />
			</button>
		{/if}
	</div>
</div>
