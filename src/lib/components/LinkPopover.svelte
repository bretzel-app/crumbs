<script lang="ts">
	import ExternalLink from 'lucide-svelte/icons/external-link';
	import { onMount } from 'svelte';

	interface Props {
		url: string;
		anchor: DOMRect;
		onClose: () => void;
	}

	let { url, anchor, onClose }: Props = $props();

	let popoverEl: HTMLDivElement | undefined = $state();
	let top = $state(0);
	let left = $state(0);

	onMount(() => {
		if (!popoverEl) return;
		const rect = popoverEl.getBoundingClientRect();

		// Position below the anchor link, or above if near viewport bottom
		const spaceBelow = window.innerHeight - anchor.bottom;
		if (spaceBelow >= rect.height + 8) {
			top = anchor.bottom + 4;
		} else {
			top = anchor.top - rect.height - 4;
		}

		left = anchor.left;
		// Clamp to viewport
		if (left + rect.width > window.innerWidth - 8) {
			left = window.innerWidth - rect.width - 8;
		}
		if (left < 8) left = 8;
	});

	function handleClickOutside(e: MouseEvent) {
		if (popoverEl && !popoverEl.contains(e.target as Node)) {
			onClose();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function openLink() {
		window.open(url, '_blank', 'noopener');
		onClose();
	}
</script>

<svelte:window onclick={handleClickOutside} onkeydown={handleKeydown} onscroll={onClose} onresize={onClose} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	bind:this={popoverEl}
	class="fixed z-50 flex items-center gap-1.5 rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1.5 shadow-[var(--card-shadow)]"
	style="top: {top}px; left: {left}px;"
	onclick={(e) => e.stopPropagation()}
	data-testid="link-popover"
>
	<button
		onclick={openLink}
		class="flex items-center gap-1 text-xs text-[var(--primary)] hover:text-[var(--primary-hover)]"
		data-testid="link-popover-open"
	>
		<ExternalLink class="h-3.5 w-3.5" />
		Open
	</button>
</div>
