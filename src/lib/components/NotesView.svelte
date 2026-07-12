<script lang="ts">
	import NoteGrid from '$lib/components/NoteGrid.svelte';
	import NoteEditor from '$lib/components/NoteEditor.svelte';
	import TagFilter from '$lib/components/TagFilter.svelte';
	import { pinnedNotes, unpinnedNotes, selectedTag, currentFilter, notes, notesLoaded, loadNotes, updateSortOrders } from '$lib/stores/notes.js';
	import { onMount } from 'svelte';
	import { replaceState } from '$app/navigation';
	import type { Note, NoteFilter } from '$lib/types/index.js';
	import Plus from 'lucide-svelte/icons/plus';
	import SquareCheck from 'lucide-svelte/icons/square-check';
	import { tooltip } from '$lib/utils/tooltip.js';

	interface Props {
		filter: NoteFilter;
		tag?: string | null;
	}

	let { filter, tag = null }: Props = $props();

	let editingNote: Note | null = $state(null);
	let showNewNote = $state(false);
	let newNoteChecklist = $state(false);

	// Sync store with route props and reload notes when filter changes
	$effect(() => {
		currentFilter.set(filter);
		selectedTag.set(tag);
		loadNotes(filter);
	});

	// Use SvelteKit's replaceState (not the raw history API) so the router keeps
	// ownership of the entry — NoteEditor's close-on-back relies on popstate being
	// handled by SvelteKit.
	function openEditor(note: Note) {
		editingNote = note;
		replaceState(`#${note.id}`, {});
	}

	function closeEditor() {
		editingNote = null;
		showNewNote = false;
		newNoteChecklist = false;
		replaceState(location.pathname, {});
	}

	function handleReorder(noteIds: string[]) {
		const orders = noteIds.map((id, index) => ({ id, sortOrder: index }));
		updateSortOrders(orders);
	}

	onMount(() => {
		const hash = location.hash.slice(1);
		if (!hash) return;

		const unsubscribe = notes.subscribe(($notes) => {
			if ($notes.length === 0) return;
			const note = $notes.find((n) => n.id === hash);
			if (note) editingNote = note;
			unsubscribe();
		});
	});
</script>

{#if filter === 'all' && !tag}
	<div class="mx-auto mb-6 hidden max-w-xl md:block">
		<div class="flex cursor-pointer items-center gap-0 rounded-sm border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-colors hover:border-[var(--primary)]">
			<button
				onclick={() => (showNewNote = true)}
				class="flex flex-1 cursor-pointer items-center gap-3 px-4 py-3 text-left text-sm text-[var(--text-muted)] hover:text-[var(--primary)]"
				data-testid="new-note-btn"
			>
				<Plus class="h-4 w-4" />
				Add a crumb...
			</button>
			<button
				onclick={() => { newNoteChecklist = true; showNewNote = true; }}
				class="cursor-pointer rounded-sm p-3 text-[var(--text-muted)] hover:text-[var(--primary)]"
				use:tooltip={"New checklist"}
				data-testid="new-checklist-btn"
			>
				<SquareCheck class="h-4 w-4" />
			</button>
		</div>
	</div>
	<button
		onclick={() => (showNewNote = true)}
		class="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-sm border border-[var(--border)] bg-[var(--primary)] text-white shadow-[var(--card-shadow)] transition-colors hover:bg-[var(--primary-hover)] md:hidden"
		aria-label="Add a crumb"
		data-testid="new-note-fab"
	>
		<Plus class="h-5 w-5" />
	</button>
{/if}

<div class="mb-4">
	<TagFilter />
</div>

{#if filter === 'archived'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Archive</h2>
{:else if filter === 'trashed'}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">Trash</h2>
{:else if tag}
	<h2 class="mb-4 text-lg font-medium text-[var(--text-muted)]">#{tag}</h2>
{/if}

{#if $pinnedNotes.length > 0}
	<div class="mb-6">
		<NoteGrid notes={$pinnedNotes} label="Pinned" onEdit={openEditor} draggable dndType="pinned-notes" onReorder={handleReorder} />
	</div>
{/if}

<NoteGrid
	notes={$unpinnedNotes}
	label={$pinnedNotes.length > 0 ? 'Others' : ''}
	onEdit={openEditor}
	draggable
	dndType="unpinned-notes"
	onReorder={handleReorder}
/>

{#if $notesLoaded && $pinnedNotes.length === 0 && $unpinnedNotes.length === 0}
	<div class="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
		<img src="/favicon.svg" alt="" class="mb-4 h-18 w-18" />
		<p class="font-['Press_Start_2P'] text-xs">
			{#if filter === 'trashed'}
				No crumbs in trash
			{:else if filter === 'archived'}
				No archived crumbs
			{:else if tag}
				No crumbs with tag #{tag}
			{:else}
				No crumbs yet
			{/if}
		</p>
	</div>
{/if}

{#if showNewNote}
	<NoteEditor note={null} isNew={true} initialChecklistMode={newNoteChecklist} onClose={closeEditor} />
{/if}

{#if editingNote}
	<NoteEditor note={editingNote} onClose={closeEditor} />
{/if}
