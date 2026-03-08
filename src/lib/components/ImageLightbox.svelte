<script lang="ts">
	import XIcon from 'lucide-svelte/icons/x';

	interface Props {
		src: string;
		alt: string;
		onClose: () => void;
	}

	const { src, alt, onClose }: Props = $props();

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
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 animate-[fade-in_150ms_ease-out]"
	onclick={handleBackgroundClick}
	data-testid="image-lightbox"
>
	<button
		onclick={onClose}
		class="absolute right-4 top-4 rounded-sm p-2 text-white hover:bg-white/10"
		aria-label="Close lightbox"
		data-testid="lightbox-close"
	>
		<XIcon class="h-6 w-6" />
	</button>

	<img
		{src}
		{alt}
		class="max-h-[90vh] max-w-[90vw] object-contain rounded-sm animate-[pop-in_150ms_ease-out]"
		data-testid="lightbox-image"
	/>
</div>
