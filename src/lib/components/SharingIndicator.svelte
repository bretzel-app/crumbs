<script lang="ts">
	import type { Collaborator } from '$lib/types/index.js';
	import Globe from 'lucide-svelte/icons/globe';
	import Users from 'lucide-svelte/icons/users';

	interface Props {
		shareToken?: string;
		collaborators: Collaborator[];
		isOwner: boolean;
	}

	const { shareToken, collaborators, isOwner }: Props = $props();

	let showPopover = $state(false);
	let hoverTimeout: ReturnType<typeof setTimeout> | undefined;

	const hasPublicLink = $derived(!!shareToken);
	const hasCollaborators = $derived(collaborators.length > 0);

	const tooltipLines = $derived.by(() => {
		const lines: string[] = [];
		if (hasPublicLink) lines.push('Shared publicly via link');
		if (hasCollaborators) {
			lines.push(`Shared with ${collaborators.length} collaborator${collaborators.length > 1 ? 's' : ''}`);
		}
		return lines;
	});

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
		class="rounded-sm p-1 {hasPublicLink ? 'text-[var(--primary)]' : 'text-[var(--text-muted)]'} hover:text-[var(--primary)]"
		title={tooltipLines.join(', ')}
		onclick={handleClick}
		data-testid="sharing-indicator"
	>
		{#if hasPublicLink}
			<Globe class="h-4 w-4" />
		{:else}
			<Users class="h-4 w-4" />
		{/if}
	</button>

	{#if showPopover}
		<div
			class="absolute right-0 bottom-full z-20 mb-1 min-w-[180px] rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 shadow-[var(--card-shadow)] animate-[fade-in_150ms_ease-out]"
			data-testid="sharing-popover"
		>
			{#if hasPublicLink}
				<div class="mb-1 flex items-center gap-1.5">
					<Globe class="h-3 w-3 text-[var(--primary)]" />
					<span class="text-xs font-semibold text-[var(--primary)]">Public link active</span>
				</div>
			{/if}
			{#if hasCollaborators}
				<p class="mb-1 text-xs font-semibold text-[var(--text-muted)]">Shared with</p>
				<ul class="space-y-0.5">
					{#if isOwner}
						<li class="text-xs text-[var(--text)]">
							You <span class="text-[var(--text-muted)]">(Owner)</span>
						</li>
					{/if}
					{#each collaborators as collab}
						<li class="text-xs text-[var(--text)]">
							{collab.displayName || collab.email}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}
</div>
