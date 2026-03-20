<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getSyncStatus, onSyncStatusChange, sync, type SyncStatus } from '$lib/sync/client.js';
	import Icon from '@iconify/svelte';

	let status: SyncStatus = $state(getSyncStatus());
	let displayStatus: SyncStatus = $state(getSyncStatus());
	let minDisplayTimeout: ReturnType<typeof setTimeout> | undefined;
	let pendingStatus: SyncStatus | undefined;

	function applyStatus(s: SyncStatus) {
		if (displayStatus === s) return;

		if (minDisplayTimeout) {
			pendingStatus = s;
			return;
		}

		displayStatus = s;
		minDisplayTimeout = setTimeout(() => {
			minDisplayTimeout = undefined;
			if (pendingStatus !== undefined && pendingStatus !== displayStatus) {
				applyStatus(pendingStatus);
				pendingStatus = undefined;
			}
		}, 300);
	}

	let unsubscribe: (() => void) | undefined;

	onMount(() => {
		unsubscribe = onSyncStatusChange((s) => {
			status = s;
			applyStatus(s);
		});
	});

	onDestroy(() => {
		unsubscribe?.();
		if (minDisplayTimeout) clearTimeout(minDisplayTimeout);
	});
</script>

<button
	class="flex cursor-pointer items-center rounded-sm p-1 transition-colors hover:bg-[var(--border-subtle)]/50"
	title="Sync status: {status} — click to sync"
	onclick={() => sync()}
	data-testid="sync-indicator"
>
	{#if displayStatus === 'synced'}
		<Icon icon="pixelarticons:cloud-done" class="h-5 w-5 text-[var(--primary)]" />
	{:else if displayStatus === 'syncing'}
		<Icon icon="pixelarticons:sync" class="h-5 w-5 text-[var(--primary)] opacity-60" />
	{:else if displayStatus === 'offline'}
		<Icon icon="pixelarticons:cloud" class="h-5 w-5 text-[var(--text-muted)]" />
	{:else}
		<Icon icon="pixelarticons:cloud" class="h-5 w-5 text-[var(--destructive)]" />
	{/if}
</button>
