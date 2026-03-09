<script lang="ts">
	import type { Collaborator } from '$lib/types/index.js';
	import Users from 'lucide-svelte/icons/users';

	interface Props {
		collaborators: Collaborator[];
		ownerName?: string;
	}

	const { collaborators, ownerName }: Props = $props();

	let showPopover = $state(false);
	let hoverTimeout: ReturnType<typeof setTimeout> | undefined;

	function handleMouseEnter() {
		hoverTimeout = setTimeout(() => {
			showPopover = true;
		}, 150);
	}

	function handleMouseLeave() {
		clearTimeout(hoverTimeout);
		showPopover = false;
	}

	function handleClick(e: Event) {
		e.stopPropagation();
		showPopover = !showPopover;
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="relative inline-flex"
	onmouseenter={handleMouseEnter}
	onmouseleave={handleMouseLeave}
>
	<button
		type="button"
		class="rounded-sm p-1 text-[var(--text-muted)] hover:text-[var(--primary)]"
		title="Shared note"
		onclick={handleClick}
		data-testid="collaborator-indicator"
	>
		<Users class="h-4 w-4" />
	</button>

	{#if showPopover}
		<div
			class="absolute left-0 bottom-full z-20 mb-1 min-w-[160px] rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 shadow-[var(--card-shadow)] animate-[fade-in_150ms_ease-out]"
			data-testid="collaborator-popover"
		>
			<p class="mb-1 text-xs font-semibold text-[var(--text-muted)]">Shared with</p>
			<ul class="space-y-0.5">
				{#if ownerName}
					<li class="text-xs text-[var(--text)]">
						{ownerName} <span class="text-[var(--text-muted)]">(Owner)</span>
					</li>
				{/if}
				{#each collaborators as collab}
					<li class="text-xs text-[var(--text)]">
						{collab.displayName || collab.email}
					</li>
				{/each}
			</ul>
		</div>
	{/if}
</div>
