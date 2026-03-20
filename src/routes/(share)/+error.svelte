<script lang="ts">
	import { page } from '$app/state';
</script>

<svelte:head>
	<title>Not Found - Crumbs</title>
</svelte:head>

<div class="w-full max-w-sm rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-8 text-center">
	<img src="/favicon.svg" alt="Crumbs" class="mx-auto h-12 w-12" />
	<h1 class="mt-4 font-['Press_Start_2P'] text-xl text-[var(--primary)]">
		{page.status}
	</h1>
	<p class="mt-4 text-sm text-[var(--text-muted)]">
		{page.error?.message ?? 'This shared note does not exist or has been removed.'}
	</p>
</div>
