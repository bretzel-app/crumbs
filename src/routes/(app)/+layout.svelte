<script lang="ts">
	import Header from '$lib/components/Layout/Header.svelte';
	import Sidebar from '$lib/components/Layout/Sidebar.svelte';
	import Toast from '$lib/components/Layout/Toast.svelte';
	import { loadNotes } from '$lib/stores/notes.js';
	import { startSync, stopSync } from '$lib/sync/client.js';
	import { initDb } from '$lib/sync/idb.js';
	import { onMount, onDestroy } from 'svelte';

	let { data, children } = $props();
	let sidebarOpen = $state(false);

	onMount(() => {
		sidebarOpen = window.matchMedia('(min-width: 1024px)').matches;
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
	<Header onMenuToggle={() => (sidebarOpen = !sidebarOpen)} user={data.user} />
	<Sidebar open={sidebarOpen} onClose={() => (sidebarOpen = false)} appVersion={data.appVersion} />

	<main class="flex-1 pt-4 transition-all {sidebarOpen ? 'lg:ml-64' : ''}">
		<div class="mx-auto max-w-7xl px-4">
			{@render children()}
		</div>
	</main>

	<footer class="pb-4 pt-8 text-center text-xs text-[var(--text-muted)] {sidebarOpen ? 'lg:ml-64' : ''}">
		Crumbs by <a href="https://bretzel.app" target="_blank" rel="noopener noreferrer" class="hover:text-[var(--primary)] transition-colors">Bretzel</a> &mdash; made with 🥨 in Strasbourg
	</footer>

	<Toast />
</div>
