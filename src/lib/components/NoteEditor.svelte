<script lang="ts">
	import { onMount } from 'svelte';
	import ColorPicker from './ColorPicker.svelte';
	import Checklist from './Checklist.svelte';
	import FormattingToolbar from './FormattingToolbar.svelte';
	import TiptapEditor from './TiptapEditor.svelte';
	import ImageUpload from './ImageUpload.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import NoteHistory from './NoteHistory.svelte';
	import { updateNote, createNote } from '$lib/stores/notes.js';
	import { notes } from '$lib/stores/notes.js';
	import { getNoteColor } from '$lib/utils/colors.js';
	import { getIsDarkMode } from '$lib/utils/theme.svelte.js';
	import { getPreferences } from '$lib/stores/preferences.svelte.js';
	import type { Editor } from '@tiptap/core';
	import type { Note, NoteColor, Attachment, Collaborator } from '$lib/types/index.js';
	import Palette from 'lucide-svelte/icons/palette';
	import SquareCheck from 'lucide-svelte/icons/square-check';
	import ImageIcon from 'lucide-svelte/icons/image';
	import Type from 'lucide-svelte/icons/type';
	import FileCode from 'lucide-svelte/icons/file-code';
	import FileText from 'lucide-svelte/icons/file-text';
	import UserPlus from 'lucide-svelte/icons/user-plus';
	import Users from 'lucide-svelte/icons/users';
	import Globe from 'lucide-svelte/icons/globe';
	import History from 'lucide-svelte/icons/history';

	interface Props {
		note: Note | null;
		isNew?: boolean;
		onClose: () => void;
	}

	const { note, isNew = false, onClose }: Props = $props();
	const prefs = getPreferences();

	// svelte-ignore state_referenced_locally
	let title = $state(note?.title ?? '');
	// svelte-ignore state_referenced_locally
	let content = $state(note?.content ?? '');
	// svelte-ignore state_referenced_locally
	let color = $state<NoteColor>(note?.color ?? prefs.defaultNoteColor);
	// svelte-ignore state_referenced_locally
	let checklistMode = $state(note?.checklistMode ?? false);
	let showColorPicker = $state(false);
	let showImageUpload = $state(false);
	// svelte-ignore state_referenced_locally
	let rawMarkdownMode = $state(note ? (note.checklistMode ?? false) : prefs.defaultNoteMode === 'markdown');
	let textareaEl: HTMLTextAreaElement | undefined = $state();
	let tiptapEditor: Editor | undefined = $state();
	let editorTick = $state(0);

	// Mutable note identity — allows transitioning from new → saved without closing
	// svelte-ignore state_referenced_locally
	let noteId = $state<string | null>(note?.id ?? null);
	// svelte-ignore state_referenced_locally
	let currentlyNew = $state(isNew);

	// svelte-ignore state_referenced_locally
	let attachmentsList = $state<Attachment[]>(note?.attachments ?? []);

	// Guard against mobile ghost clicks: on touch devices, a tap on the note card
	// can produce a synthetic click that lands on editor buttons rendered at the same
	// coordinates. Suppress pointer events on toolbar controls until mount completes.
	let toolbarInteractive = $state(false);
	onMount(() => {
		const timer = setTimeout(() => { toolbarInteractive = true; }, 150);
		return () => clearTimeout(timer);
	});

	let showShareDialog = $state(false);
	let showHistory = $state(false);
	// svelte-ignore state_referenced_locally
	let collaboratorsList = $state<Collaborator[]>(note?.collaborators ?? []);
	// svelte-ignore state_referenced_locally
	let currentShareToken = $state<string | undefined>(note?.shareToken);
	const isOwner = $derived(note?.isOwner !== false);
	const isShared = $derived(collaboratorsList.length > 0);
	const hasPublicLink = $derived(!!currentShareToken);
	// Use displayName from first user or 'You' for owner
	const ownerName = $derived(isOwner ? 'You' : 'Owner');

	function handleCollaboratorsUpdate(updated: Collaborator[]) {
		collaboratorsList = updated;
		if (noteId) {
			notes.update((list) =>
				list.map((n) =>
					n.id === noteId
						? { ...n, collaborators: updated, isShared: updated.length > 0 }
						: n
				)
			);
		}
	}

	function handleShareUpdate(token: string | null) {
		currentShareToken = token ?? undefined;
		if (noteId) {
			notes.update((list) =>
				list.map((n) =>
					n.id === noteId
						? { ...n, shareToken: token ?? undefined }
						: n
				)
			);
		}
	}

	async function toggleShareDialog() {
		if (currentlyNew) {
			const id = await autoSave();
			if (!id) return;
		}
		showShareDialog = !showShareDialog;
	}

	async function toggleHistory() {
		if (currentlyNew) {
			const id = await autoSave();
			if (!id) return;
		}
		showHistory = !showHistory;
	}

	async function handleHistoryRestored() {
		if (!noteId) return;
		// Reload the note content from the server after a restore
		try {
			const res = await fetch(`/api/notes/${noteId}`);
			if (res.ok) {
				const updated = await res.json();
				title = updated.title ?? '';
				content = updated.content ?? '';
				color = updated.color ?? 'default';
				checklistMode = updated.checklistMode ?? false;
				// Bump editor tick to force TiptapEditor to re-render
				editorTick++;
				// Update the store too
				notes.update((list) =>
					list.map((n) => (n.id === noteId ? { ...n, ...updated } : n))
				);
			}
		} catch {
			// failed silently
		}
	}

	// Fetch attachments for existing notes if not pre-populated (e.g. loaded from IDB)
	$effect(() => {
		if (noteId && !currentlyNew && (!note?.attachments || note.attachments.length === 0)) {
			fetch(`/api/notes/${noteId}/attachments`)
				.then((res) => res.ok ? res.json() : [])
				.then((data: Attachment[]) => {
					if (data.length > 0) attachmentsList = data;
				})
				.catch(() => {});
		}
	});

	function handleAttachmentUpload(attachment: Attachment) {
		attachmentsList = [...attachmentsList, attachment];
	}

	async function handleToggleFeatured(attachmentId: string, featured: boolean) {
		if (!noteId) return;
		try {
			const res = await fetch(`/api/notes/${noteId}/attachments?attachmentId=${attachmentId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ featured })
			});
			if (res.ok) {
				attachmentsList = attachmentsList.map((a) =>
					a.id === attachmentId ? { ...a, featured } : a
				);
			}
		} catch (err) {
			console.error('Failed to toggle featured:', err);
		}
	}

	async function handleAttachmentRemove(attachmentId: string) {
		if (!noteId) return;
		try {
			await fetch(`/api/notes/${noteId}/attachments?attachmentId=${attachmentId}`, {
				method: 'DELETE'
			});
			attachmentsList = attachmentsList.filter((a) => a.id !== attachmentId);
		} catch (err) {
			console.error('Failed to remove attachment:', err);
		}
	}

	let bgStyle = $state('');
	$effect(() => {
		bgStyle = `background-color: ${getNoteColor(color, getIsDarkMode())}`;
	});

	// Use pointer events to detect backdrop clicks. Unlike mouse events,
	// pointer events are never synthetically re-dispatched from touch, so
	// the tap that opened the editor on mobile cannot ghost-click the overlay.
	// Both pointerdown and pointerup must target the overlay itself to close.
	let pointerdownOnOverlay = false;

	function handleOverlayPointerdown(e: PointerEvent) {
		pointerdownOnOverlay = e.target === e.currentTarget;
	}

	function handleOverlayPointerup(e: PointerEvent) {
		if (pointerdownOnOverlay && e.target === e.currentTarget) saveAndClose();
		pointerdownOnOverlay = false;
	}

	async function saveAndClose() {
		if (!title.trim() && !content.trim()) {
			onClose();
			return;
		}

		if (currentlyNew) {
			await createNote({ title, content, color, checklistMode });
		} else if (noteId) {
			await updateNote(noteId, { title, content, color, checklistMode });
		}
		onClose();
	}

	/** Auto-save a new note without closing, returns the new note ID */
	async function autoSave(): Promise<string | null> {
		if (!currentlyNew) return noteId;
		const created = await createNote({
			title: title || 'Untitled',
			content,
			color,
			checklistMode
		});
		if (created) {
			noteId = created.id;
			currentlyNew = false;
			return created.id;
		}
		return null;
	}

	async function toggleImageUpload() {
		if (currentlyNew) {
			const id = await autoSave();
			if (!id) return;
		}
		showImageUpload = !showImageUpload;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			saveAndClose();
		}
	}

	function handleColorSelect(c: NoteColor) {
		color = c;
		showColorPicker = false;
	}

	function toggleMarkdownMode() {
		rawMarkdownMode = !rawMarkdownMode;
		if (rawMarkdownMode) {
			requestAnimationFrame(() => textareaEl?.focus());
		}
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/50 pt-20 pb-10 animate-[fade-in_150ms_ease-out]"
	onpointerdown={handleOverlayPointerdown}
	onpointerup={handleOverlayPointerup}
	onkeydown={handleKeydown}
	data-testid="note-editor-overlay"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="mx-4 flex w-full max-w-xl md:max-w-2xl flex-col overflow-hidden rounded-sm border border-[var(--border)] shadow-[var(--card-shadow)] animate-[pop-in_150ms_ease-out]"
		style={bgStyle}
		onkeydown={(e) => { e.stopPropagation(); handleKeydown(e); }}
		data-testid="note-editor"
	>
		<!-- Title -->
		<input
			type="text"
			placeholder="Title"
			bind:value={title}
			class="w-full bg-transparent px-4 pt-4 text-lg font-semibold text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
			data-testid="note-title-input"
			onkeydown={(e) => {
				if (e.key === 'Enter') {
					e.preventDefault();
					if (textareaEl) textareaEl.focus();
					else if (tiptapEditor) tiptapEditor.commands.focus('start');
				}
			}}
		/>

		<!-- Content -->
		<div class="max-h-[60vh] overflow-y-auto">
			{#if checklistMode}
				<div class="px-4 py-2">
					<Checklist {content} onChange={(c) => (content = c)} />
				</div>
			{:else if rawMarkdownMode}
				<textarea
					bind:this={textareaEl}
					placeholder="Add a crumb..."
					bind:value={content}
					class="min-h-[300px] w-full resize-none bg-transparent px-4 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-muted)]"
					rows="12"
					data-testid="note-content-input"
				></textarea>
			{:else}
				<TiptapEditor
					{content}
					onUpdate={(md) => (content = md)}
					onEditor={(e) => (tiptapEditor = e)}
					onTransaction={() => editorTick++}
					placeholder="Add a crumb..."
				/>
			{/if}
		</div>

		<!-- Image attachments -->
		{#if noteId && (showImageUpload || attachmentsList.length > 0)}
			<div class="border-t border-[var(--border-subtle)] px-4 py-2">
				<ImageUpload
					noteId={noteId}
					attachments={attachmentsList}
					onUpload={handleAttachmentUpload}
					onRemove={handleAttachmentRemove}
					onToggleFeatured={handleToggleFeatured}
					showDropZone={showImageUpload}
				/>
			</div>
		{/if}

		<!-- Formatting toolbar -->
		{#if !rawMarkdownMode && !checklistMode}
			<div style={toolbarInteractive ? '' : 'pointer-events: none'}>
				<FormattingToolbar editor={tiptapEditor} tick={editorTick} />
			</div>
		{/if}

		<!-- Toolbar -->
		<div
			class="flex items-center justify-between border-t border-[var(--border-subtle)] px-2 py-2"
			style={toolbarInteractive ? '' : 'pointer-events: none'}
		>
			<div class="flex items-center gap-1">
				<!-- Color picker toggle -->
				<div class="relative">
					<button
						onclick={() => (showColorPicker = !showColorPicker)}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						title="Background color"
						data-testid="color-picker-toggle"
					>
						<Palette class="h-5 w-5 text-[var(--text-muted)]" />
					</button>
					{#if showColorPicker}
						<div class="absolute left-0 bottom-full z-10 mb-2 w-[calc(100vw-4rem)] max-w-xs rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] p-2">
							<ColorPicker selected={color} onSelect={handleColorSelect} />
						</div>
					{/if}
				</div>

				<!-- Checklist mode toggle -->
				<button
					onclick={() => (checklistMode = !checklistMode)}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10"
					title={checklistMode ? 'Switch to text' : 'Checklist mode'}
					data-testid="checklist-toggle"
				>
					{#if checklistMode}
						<Type class="h-5 w-5" />
					{:else}
						<SquareCheck class="h-5 w-5" />
					{/if}
				</button>

				<!-- Image attachment toggle -->
				<button
					onclick={toggleImageUpload}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10"
					title="Image attachments"
					data-testid="image-toggle"
				>
					<ImageIcon class="h-5 w-5 {showImageUpload ? 'text-[var(--primary)]' : ''}" />
				</button>

				<!-- Raw markdown mode toggle -->
				<button
					onclick={toggleMarkdownMode}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10 disabled:opacity-30 disabled:cursor-not-allowed"
					title={rawMarkdownMode ? 'Rich text mode' : 'Markdown mode'}
					disabled={checklistMode}
					data-testid="markdown-toggle"
				>
					{#if rawMarkdownMode}
						<FileText class="h-5 w-5" />
					{:else}
						<FileCode class="h-5 w-5" />
					{/if}
				</button>

				<!-- Share button (owner only for new shares, all for viewing) -->
				{#if isOwner}
					<button
						onclick={toggleShareDialog}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						title="Share note"
						data-testid="share-toggle"
					>
						{#if hasPublicLink}
							<Globe class="h-5 w-5 text-[var(--primary)]" />
						{:else if isShared}
							<Users class="h-5 w-5 text-[var(--primary)]" />
						{:else}
							<UserPlus class="h-5 w-5" />
						{/if}
					</button>
				{:else if isShared}
					<span class="flex items-center gap-1 rounded-sm p-2 text-[var(--text-muted)]" title="Shared note">
						<Users class="h-5 w-5" />
					</span>
				{/if}

				<!-- History button (only for saved notes) -->
				{#if !currentlyNew}
					<button
						onclick={toggleHistory}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						title="Version history"
						data-testid="history-toggle"
					>
						<History class="h-5 w-5 {showHistory ? 'text-[var(--primary)]' : ''}" />
					</button>
				{/if}
			</div>

			<button
				onclick={saveAndClose}
				class="rounded-sm px-4 py-1 text-sm font-medium text-[var(--text)] hover:bg-[var(--border)]/10"
				data-testid="close-editor-btn"
			>
				Close
			</button>
		</div>
	</div>
</div>

{#if showShareDialog && noteId}
	<ShareDialog
		noteId={noteId}
		collaborators={collaboratorsList}
		{ownerName}
		shareToken={currentShareToken}
		onClose={() => (showShareDialog = false)}
		onUpdate={handleCollaboratorsUpdate}
		onShareUpdate={handleShareUpdate}
	/>
{/if}

{#if showHistory && noteId}
	<NoteHistory
		noteId={noteId}
		onClose={() => (showHistory = false)}
		onRestored={handleHistoryRestored}
	/>
{/if}
