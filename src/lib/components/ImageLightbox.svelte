<script lang="ts">
	import Icon from '@iconify/svelte';

	interface Props {
		src: string;
		alt: string;
		onClose: () => void;
	}

	const { src, alt, onClose }: Props = $props();

	let dialogEl: HTMLDivElement | undefined = $state();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			e.stopPropagation();
			onClose();
		}
	}

	function handleBackgroundClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	$effect(() => {
		dialogEl?.focus();
	});
</script>

<div
	bind:this={dialogEl}
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fade-in_150ms_ease-out]"
	onclick={handleBackgroundClick}
	onkeydown={handleKeydown}
	role="dialog"
	aria-modal="true"
	aria-label="Image lightbox"
	tabindex="-1"
	data-testid="image-lightbox"
>
	<button
		onclick={onClose}
		class="absolute right-4 top-4 rounded-sm p-2 text-white hover:bg-white/10"
		aria-label="Close lightbox"
		data-testid="lightbox-close"
	>
		<Icon icon="pixelarticons:close" class="h-6 w-6" />
	</button>

	<img
		{src}
		{alt}
		class="max-h-[90vh] max-w-[90vw] object-contain rounded-sm animate-[pop-in_150ms_ease-out]"
		data-testid="lightbox-image"
	/>
</div>
