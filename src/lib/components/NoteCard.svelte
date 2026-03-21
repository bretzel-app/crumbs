<script lang="ts">
	import { getNoteColor } from '$lib/utils/colors.js';
	import { getIsDarkMode } from '$lib/utils/theme.svelte.js';
	import { renderMarkdown } from '$lib/utils/markdown.js';
	import { togglePin, trashNote, archiveNote, unarchiveNote, restoreNote, deleteNote, leaveNote, currentFilter } from '$lib/stores/notes.js';
	import ImageLightbox from './ImageLightbox.svelte';
	import SharingIndicator from './SharingIndicator.svelte';
	import type { Note } from '$lib/types/index.js';
	import Undo2 from 'lucide-svelte/icons/undo-2';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import Bookmark from 'lucide-svelte/icons/bookmark';
	import Archive from 'lucide-svelte/icons/archive';
	import ArchiveRestore from 'lucide-svelte/icons/archive-restore';
	import UserMinus from 'lucide-svelte/icons/user-minus';

	interface ChecklistItem {
		text: string;
		checked: boolean;
	}

	interface Props {
		note: Note;
		onEdit: (note: Note) => void;
		fullHeight?: boolean;
	}

	let { note, onEdit, fullHeight = false }: Props = $props();

	$effect(() => {
		cardStyle = `background-color: ${getNoteColor(note.color, getIsDarkMode())}`;
	});

	let cardStyle = $state('');
	let lightboxSrc = $state<string | null>(null);
	let lightboxAlt = $state('');

	const renderedContent = $derived(renderMarkdown(note.content));

	const checklistItems = $derived<ChecklistItem[]>(
		note.checklistMode
			? note.content.split('\n').filter(l => l.trim()).map(line => ({
					text: line.replace(/^- \[[ x]\] /, ''),
					checked: line.startsWith('- [x] ')
				}))
			: []
	);

	const activeChecklistItems = $derived(checklistItems.filter(i => !i.checked));
	const doneChecklistItems = $derived(checklistItems.filter(i => i.checked));
	const sortedChecklistItems = $derived([...activeChecklistItems, ...doneChecklistItems]);

	const featuredAttachments = $derived((note.attachments ?? []).filter(a => a.featured));

	function stop(fn: () => void) {
		return (e: Event) => {
			e.stopPropagation();
			fn();
		};
	}

</script>

<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
<article
	class="group relative cursor-pointer rounded-sm border border-[var(--border-subtle)] p-4 outline-none transition-all hover:border-[var(--primary)] shadow-[var(--card-shadow)] hover:shadow-[var(--card-shadow-hover)] max-h-[17rem] overflow-hidden {fullHeight ? 'h-full' : ''}"
	style={cardStyle}
	onclick={() => onEdit(note)}
	onkeydown={(e) => e.key === 'Enter' && onEdit(note)}
	role="button"
	tabindex="0"
	data-testid="note-card"
	data-note-id={note.id}
>
	<!-- Thumbnail strip (featured images only) -->
	{#if featuredAttachments.length > 0}
		<div class="-mx-4 -mt-4 mb-3 flex overflow-hidden rounded-t-sm" data-testid="card-thumbnails">
			{#each featuredAttachments.slice(0, 3) as attachment}
				<div class="relative min-w-0 flex-1">
					<button
						type="button"
						class="h-24 w-full cursor-pointer p-0 border-0 bg-transparent"
						onclick={(e) => { e.stopPropagation(); lightboxSrc = `/api/notes/${note.id}/attachments?attachmentId=${attachment.id}`; lightboxAlt = attachment.filename; }}
						data-testid="card-thumbnail"
					>
						<img
							src="/api/notes/{note.id}/attachments?attachmentId={attachment.id}&thumb=1"
							alt={attachment.filename}
							class="h-24 w-full object-cover"
							loading="lazy"
						/>
					</button>
				</div>
			{/each}
			{#if featuredAttachments.length > 3}
				<div class="absolute right-1 top-1 rounded-sm bg-black/60 px-1.5 py-0.5 text-xs font-medium text-white" data-testid="card-thumbnail-count">
					+{featuredAttachments.length - 3}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Status indicators (top-right) -->
	<div class="absolute top-1.5 right-1.5 flex items-center gap-0.5">
		{#if note.shareToken || (note.isShared && note.collaborators)}
			<SharingIndicator
				shareToken={note.shareToken}
				collaborators={note.collaborators ?? []}
				isOwner={note.isOwner ?? true}
			/>
		{/if}
		{#if note.pinned}
			<button
				onclick={stop(() => togglePin(note.id, note.pinned))}
				class="rounded-sm p-1 text-[var(--primary)] hover:bg-[var(--border)]/10"
				title="Unpin"
				data-testid="pin-indicator"
			>
				<Bookmark class="h-4 w-4 fill-[var(--primary)]" />
			</button>
		{/if}
	</div>

	{#if note.title}
		<h3 class="mb-2 text-sm font-semibold text-[var(--text)]">{note.title}</h3>
	{/if}

	{#if note.checklistMode && checklistItems.length > 0}
		<ul class="space-y-2 mb-6" data-testid="note-checklist-preview">
			{#each sortedChecklistItems.slice(0, 8) as item}
				<li class="flex items-start gap-2 text-sm {item.checked ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text)]'}">
					<input
						type="checkbox"
						checked={item.checked}
						disabled
						class="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--border-subtle)] text-[var(--primary)]"
						data-testid="card-checklist-checkbox"
					/>
					<span class="break-words min-w-0">{item.text}</span>
				</li>
			{/each}
			{#if checklistItems.length > 8}
				<li class="text-xs text-[var(--text-muted)]">+{checklistItems.length - 8} more</li>
			{/if}
		</ul>
	{:else if note.content}
		<div class="prose prose-sm line-clamp-6 max-w-none text-sm text-[var(--text-muted)]" data-testid="note-content-preview">
			{@html renderedContent}
		</div>
	{/if}

	<!-- Action buttons - show on hover -->
	<div class="absolute bottom-1 right-1 flex gap-1 max-md:opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100">
		{#if $currentFilter === 'trashed'}
			<button
				onclick={stop(() => restoreNote(note.id))}
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title="Restore"
				data-testid="restore-btn"
			>
				<Undo2 class="h-4 w-4" />
			</button>
			<button
				onclick={stop(() => deleteNote(note.id))}
				class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
				title="Delete forever"
				data-testid="delete-forever-btn"
			>
				<Trash2 class="h-4 w-4 text-[var(--destructive)]" />
			</button>
		{:else}
			{#if !note.pinned}
				<button
					onclick={stop(() => togglePin(note.id, note.pinned))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Pin"
					data-testid="pin-btn"
				>
					<Bookmark class="h-4 w-4" />
				</button>
			{/if}
			{#if $currentFilter === 'archived'}
				<button
					onclick={stop(() => unarchiveNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Unarchive"
					data-testid="unarchive-btn"
				>
					<ArchiveRestore class="h-4 w-4" />
				</button>
			{:else}
				<button
					onclick={stop(() => archiveNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Archive"
					data-testid="archive-btn"
				>
					<Archive class="h-4 w-4" />
				</button>
			{/if}
			{#if note.isShared && !note.isOwner}
				<button
					onclick={stop(() => leaveNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Leave note"
					data-testid="leave-btn"
				>
					<UserMinus class="h-4 w-4" />
				</button>
			{:else}
				<button
					onclick={stop(() => trashNote(note.id))}
					class="rounded-sm p-1.5 hover:bg-[var(--border)]/10"
					title="Delete"
					data-testid="trash-btn"
				>
					<Trash2 class="h-4 w-4" />
				</button>
			{/if}
		{/if}
	</div>

	{#if lightboxSrc}
		<ImageLightbox src={lightboxSrc} alt={lightboxAlt} onClose={() => lightboxSrc = null} />
	{/if}
</article>

