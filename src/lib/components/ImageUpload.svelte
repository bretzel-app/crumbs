<script lang="ts">
	import XIcon from 'lucide-svelte/icons/x';
	import Star from 'lucide-svelte/icons/star';
	import RefreshCw from 'lucide-svelte/icons/refresh-cw';
	import ImageLightbox from './ImageLightbox.svelte';
	import type { Attachment } from '$lib/types/index.js';
	import { optimizeImage } from '$lib/utils/image-optimize.js';
	import { browser } from '$app/environment';
	import { addPendingAttachment, type PendingAttachment } from '$lib/sync/idb.js';

	interface Props {
		noteId: string;
		attachments: Attachment[];
		onUpload: (attachment: Attachment) => void;
		onRemove: (attachmentId: string) => void;
		onToggleFeatured?: (attachmentId: string, featured: boolean) => void;
	}

	let { noteId, attachments = [], onUpload, onRemove, onToggleFeatured }: Props = $props();

	let uploading = $state(false);
	let optimizing = $state(false);
	let dragOver = $state(false);
	let lightboxSrc = $state<string | null>(null);
	let lightboxAlt = $state('');

	async function handleFiles(files: FileList | null) {
		if (!files || !noteId) return;

		for (const file of files) {
			if (!file.type.startsWith('image/')) continue;

			optimizing = true;
			let optimized: Blob;
			let thumbnail: Blob;
			try {
				const result = await optimizeImage(file);
				optimized = result.optimized;
				thumbnail = result.thumbnail;
			} catch (err) {
				console.error('Optimization failed, using original:', err);
				optimized = file;
				thumbnail = file;
			}
			optimizing = false;

			// Offline: store in IDB and display via blob URL
			if (browser && !navigator.onLine) {
				const tempId = crypto.randomUUID();
				const pending: PendingAttachment = {
					id: tempId,
					noteId,
					optimized,
					thumbnail,
					filename: file.name,
					mimeType: optimized.type || file.type,
					timestamp: Date.now()
				};
				await addPendingAttachment(pending);

				const blobUrl = URL.createObjectURL(optimized);
				onUpload({
					id: tempId,
					noteId,
					filename: file.name,
					mimeType: optimized.type || file.type,
					size: optimized.size,
					path: blobUrl,
					pending: true,
					createdAt: new Date()
				} as Attachment & { pending: boolean });
				continue;
			}

			uploading = true;
			const formData = new FormData();
			formData.append('file', new File([optimized], file.name, { type: optimized.type || file.type }));
			formData.append('thumbnail', new File([thumbnail], `${file.name}_thumb.webp`, { type: 'image/webp' }));

			try {
				const res = await fetch(`/api/notes/${noteId}/attachments`, {
					method: 'POST',
					body: formData
				});
				if (res.ok) {
					const attachment = await res.json();
					onUpload(attachment);
				}
			} catch (err) {
				console.error('Upload failed:', err);
			}
			uploading = false;
		}
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		dragOver = false;
		handleFiles(e.dataTransfer?.files ?? null);
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		dragOver = true;
	}
</script>

<div data-testid="image-upload">
	<!-- Existing attachments -->
	{#if attachments.length > 0}
		<div class="mb-2 flex flex-wrap gap-2">
			{#each attachments as attachment}
				{@const isPending = 'pending' in attachment && attachment.pending}
				{@const imgSrc = isPending ? attachment.path : `/api/notes/${noteId}/attachments?attachmentId=${attachment.id}`}
				<div class="group relative">
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
					<img
						src={imgSrc}
						alt={attachment.filename}
						class="h-20 w-20 cursor-pointer rounded-sm object-cover {isPending ? 'opacity-70' : ''}"
						onclick={() => { lightboxSrc = imgSrc; lightboxAlt = attachment.filename; }}
						data-testid="attachment-thumbnail"
					/>
					{#if isPending}
						<div class="absolute bottom-0.5 left-0.5 rounded-sm bg-black/50 p-0.5" title="Pending sync">
							<RefreshCw class="h-3 w-3 text-white" />
						</div>
					{:else if onToggleFeatured}
						<button
							onclick={() => onToggleFeatured(attachment.id, !attachment.featured)}
							class="absolute bottom-0.5 right-0.5 rounded-full bg-black/50 p-0.5 {attachment.featured ? 'block' : 'hidden group-hover:block'}"
							aria-label={attachment.featured ? 'Unfeature image' : 'Feature image'}
							data-testid="toggle-featured"
						>
							<Star class="h-3 w-3 {attachment.featured ? 'fill-[var(--primary)] text-[var(--primary)]' : 'text-white'}" />
						</button>
					{/if}
					<button
						onclick={() => onRemove(attachment.id)}
						class="absolute -right-1 -top-1 hidden rounded-full bg-[var(--destructive)] p-0.5 text-white group-hover:block"
						aria-label="Remove attachment"
						data-testid="remove-attachment"
					>
						<XIcon class="h-3 w-3" />
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Upload area -->
	<div
		class="rounded-sm border-2 border-dashed p-4 text-center transition-colors {dragOver ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-[var(--border-subtle)]'}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragleave={() => (dragOver = false)}
		role="button"
		tabindex="0"
		data-testid="upload-dropzone"
	>
		{#if optimizing}
			<p class="text-sm text-[var(--text-muted)]">Optimizing...</p>
		{:else if uploading}
			<p class="text-sm text-[var(--text-muted)]">Uploading...</p>
		{:else}
			<label class="cursor-pointer">
				<span class="text-sm text-[var(--text-muted)]">Drop images here or <span class="text-[var(--primary)] underline">browse</span></span>
				<input
					type="file"
					accept="image/*"
					multiple
					class="hidden"
					onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
					data-testid="file-input"
				/>
			</label>
		{/if}
	</div>
</div>

{#if lightboxSrc}
	<ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => lightboxSrc = null} />
{/if}
