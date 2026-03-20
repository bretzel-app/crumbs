<script lang="ts">
	let { children } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-[var(--bg-base)] text-[var(--text)]">
	{@render children()}
</div>
