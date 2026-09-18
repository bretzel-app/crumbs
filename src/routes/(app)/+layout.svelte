<script lang="ts">
	import Header from '$lib/components/Layout/Header.svelte';
	import Sidebar from '$lib/components/Layout/Sidebar.svelte';
	import Toast from '$lib/components/Layout/Toast.svelte';
	import { loadNotes } from '$lib/stores/notes.js';
	import { startSync, stopSync } from '$lib/sync/client.js';
	import { initDb } from '$lib/sync/idb.js';
	import { initPreferences, getPreferences } from '$lib/stores/preferences.svelte.js';
	import { onMount, onDestroy } from 'svelte';

	let { data, children } = $props();
	let sidebarOpen = $state(false);
	const prefs = $derived(getPreferences());

	onMount(() => {
		initPreferences();
		const prefState = getPreferences();
		if (prefState.sidebarDefaultState === 'collapsed') {
			sidebarOpen = false;
		} else {
			sidebarOpen = window.matchMedia('(min-width: 1024px)').matches;
		}
		if (data.user) {
			initDb(data.user.id);
		}
		loadNotes();
		startSync();
	});

	onDestroy(() => {
		stopSync();
	});
</script>

<div class="flex min-h-screen flex-col bg-[var(--bg-base)] text-[var(--text)]">
	<!-- RGAA 12.7: header and sidebar repeat on every page, so keyboard users get a way past them. -->
	<a
		href="#main-content"
		class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-sm focus:border focus:border-[var(--border)] focus:bg-[var(--bg-surface)] focus:px-4 focus:py-2 focus:text-sm focus:text-[var(--text)] focus:shadow-[var(--card-shadow)]"
		data-testid="skip-link"
	>
		Skip to content
	</a>
	<Header onMenuToggle={() => (sidebarOpen = !sidebarOpen)} />
	<Sidebar open={sidebarOpen} onClose={() => (sidebarOpen = false)} />

	<main id="main-content" tabindex="-1" class="flex-1 pt-4 outline-none transition-all {sidebarOpen ? 'lg:ml-64' : ''}">
		<div class="mx-auto max-w-7xl px-4">
			{@render children()}
		</div>
	</main>

	{#if !prefs.hideFooter}
		<footer class="pb-4 pt-8 text-center text-xs text-[var(--text-muted)] {sidebarOpen ? 'lg:ml-64' : ''}" data-testid="app-footer">
			Crumbs by <a href="https://bretzel.app" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--primary)] transition-colors">Bretzel</a> &mdash; made with 🥨 in Strasbourg
		</footer>
	{/if}

	<Toast />
</div>
