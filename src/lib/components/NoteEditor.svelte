<script lang="ts">
	import { onMount } from 'svelte';
	import ColorPicker from './ColorPicker.svelte';
	import Checklist from './Checklist.svelte';
	import FormattingToolbar from './FormattingToolbar.svelte';
	import TiptapEditor from './TiptapEditor.svelte';
	import ImageUpload from './ImageUpload.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import NoteHistory from './NoteHistory.svelte';
	import { updateNote, createNote, trashNote, archiveNote } from '$lib/stores/notes.js';
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
	import EllipsisVertical from 'lucide-svelte/icons/ellipsis-vertical';
	import Trash2 from 'lucide-svelte/icons/trash-2';
	import ListX from 'lucide-svelte/icons/list-x';
	import Archive from 'lucide-svelte/icons/archive';
	import { parseChecklist, serializeChecklist } from '$lib/utils/checklist.js';
	import { tooltip } from '$lib/utils/tooltip.js';

	interface Props {
		note: Note | null;
		isNew?: boolean;
		initialChecklistMode?: boolean;
		onClose: () => void;
	}

	const { note, isNew = false, initialChecklistMode = false, onClose }: Props = $props();
	const prefs = getPreferences();

	// svelte-ignore state_referenced_locally
	let title = $state(note?.title ?? '');
	// svelte-ignore state_referenced_locally
	let content = $state(note?.content ?? '');
	// svelte-ignore state_referenced_locally
	let color = $state<NoteColor>(note?.color ?? prefs.defaultNoteColor);
	// svelte-ignore state_referenced_locally
	let checklistMode = $state(note?.checklistMode ?? initialChecklistMode);
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

	// Auto-save: track last-saved state to detect real changes
	let lastSavedTitle = note?.title ?? '';
	let lastSavedContent = note?.content ?? '';
	let lastSavedColor: NoteColor = note?.color ?? prefs.defaultNoteColor;
	let lastSavedChecklistMode = note?.checklistMode ?? initialChecklistMode;
	let isSaving = false;
	let savingPromise: Promise<void> | null = null;
	let autoSaveTimer: ReturnType<typeof setTimeout> | undefined;
	// TiptapEditor fires onUpdate on init with round-tripped markdown that may differ
	// from the original. Track whether auto-save should be active yet.
	let autoSaveReady = isNew;

	function hasUnsavedChanges(): boolean {
		return (
			title !== lastSavedTitle ||
			content !== lastSavedContent ||
			color !== lastSavedColor ||
			checklistMode !== lastSavedChecklistMode
		);
	}

	async function performSave() {
		if (isSaving) return;
		// Snapshot current fields to avoid races with user edits during await
		const snap = { title, content, color, checklistMode };
		if (!snap.title.trim() && !snap.content.trim()) return;
		if (
			snap.title === lastSavedTitle &&
			snap.content === lastSavedContent &&
			snap.color === lastSavedColor &&
			snap.checklistMode === lastSavedChecklistMode
		) return;

		isSaving = true;
		try {
			if (currentlyNew) {
				const created = await createNote(snap);
				if (created) {
					noteId = created.id;
					currentlyNew = false;
					lastSavedTitle = snap.title;
					lastSavedContent = snap.content;
					lastSavedColor = snap.color;
					lastSavedChecklistMode = snap.checklistMode;
				}
			} else if (noteId) {
				const updated = await updateNote(noteId, snap);
				if (updated) {
					lastSavedTitle = snap.title;
					lastSavedContent = snap.content;
					lastSavedColor = snap.color;
					lastSavedChecklistMode = snap.checklistMode;
				}
			}
		} finally {
			isSaving = false;
		}
	}

	// Debounced auto-save: triggers 2s after the user stops editing
	$effect(() => {
		const _t = title;
		const _c = content;
		const _col = color;
		const _cm = checklistMode;

		if (!autoSaveReady) {
			// Absorb TiptapEditor's initial content normalization as the baseline
			lastSavedContent = _c;
			autoSaveReady = true;
			return;
		}

		if (_t === lastSavedTitle && _c === lastSavedContent && _col === lastSavedColor && _cm === lastSavedChecklistMode) return;
		if (!_t.trim() && !_c.trim()) return;

		autoSaveTimer = setTimeout(() => {
			savingPromise = performSave();
		}, 2000);

		return () => clearTimeout(autoSaveTimer);
	});

	// Safety net: save on tab close / navigation
	$effect(() => {
		function handleBeforeUnload() {
			if (hasUnsavedChanges() && (title.trim() || content.trim())) {
				performSave();
			}
		}
		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	});

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
	let showOverflowMenu = $state(false);
	let overflowBtnEl: HTMLButtonElement | undefined = $state();
	let overflowMenuEl: HTMLDivElement | undefined = $state();

	// Close overflow menu when clicking outside
	$effect(() => {
		if (!showOverflowMenu) return;
		function handleClickOutside(e: MouseEvent) {
			const target = e.target as Node;
			if (overflowBtnEl?.contains(target) || overflowMenuEl?.contains(target)) return;
			showOverflowMenu = false;
		}
		// Use setTimeout to avoid the current click from closing the menu
		const timer = setTimeout(() => document.addEventListener('click', handleClickOutside), 0);
		return () => {
			clearTimeout(timer);
			document.removeEventListener('click', handleClickOutside);
		};
	});

	const hasDoneItems = $derived(
		checklistMode && content.includes('[x]')
	);
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
		const updated = [...attachmentsList, attachment];
		attachmentsList = updated;
		if (noteId) {
			notes.update((list) =>
				list.map((n) => (n.id === noteId ? { ...n, attachments: updated } : n))
			);
		}
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
				const updated = attachmentsList.map((a) =>
					a.id === attachmentId ? { ...a, featured } : a
				);
				attachmentsList = updated;
				// Keep the notes store in sync so the card reflects featured state
				notes.update((list) =>
					list.map((n) => (n.id === noteId ? { ...n, attachments: updated } : n))
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
			const updated = attachmentsList.filter((a) => a.id !== attachmentId);
			attachmentsList = updated;
			notes.update((list) =>
				list.map((n) => (n.id === noteId ? { ...n, attachments: updated } : n))
			);
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
		clearTimeout(autoSaveTimer);
		// Wait for any in-flight auto-save to finish
		if (savingPromise) await savingPromise;

		if (!title.trim() && !content.trim()) {
			onClose();
			return;
		}

		// Final save if auto-save hasn't caught up yet
		if (hasUnsavedChanges()) {
			await performSave();
		}
		onClose();
	}

	/** Auto-save a new note without closing, returns the new note ID */
	async function autoSave(): Promise<string | null> {
		if (!currentlyNew) return noteId;
		clearTimeout(autoSaveTimer);
		if (savingPromise) await savingPromise;
		// For feature-triggered saves (image upload, share), use 'Untitled' fallback
		if (!title.trim()) title = 'Untitled';
		await performSave();
		return noteId;
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

	async function handleArchive() {
		showOverflowMenu = false;
		if (noteId) {
			await archiveNote(noteId);
			onClose();
		}
	}

	async function handleTrash() {
		showOverflowMenu = false;
		if (noteId) {
			await trashNote(noteId);
			onClose();
		}
	}

	function deleteCheckedItems() {
		const items = parseChecklist(content).filter((i) => !i.checked);
		content = serializeChecklist(items);
		showOverflowMenu = false;
	}

	function uncheckAllItems() {
		const items = parseChecklist(content).map((i) => ({ ...i, checked: false }));
		content = serializeChecklist(items);
		showOverflowMenu = false;
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
						use:tooltip={"Background color"}
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

				<!-- Image attachment toggle -->
				<button
					onclick={toggleImageUpload}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10"
					use:tooltip={"Attachments"}
					data-testid="image-toggle"
				>
					<ImageIcon class="h-5 w-5 {showImageUpload ? 'text-[var(--primary)]' : ''}" />
				</button>

				<!-- Share button -->
				{#if isOwner}
					<button
						onclick={toggleShareDialog}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						use:tooltip={"Share"}
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
					<span class="flex items-center gap-1 rounded-sm p-2 text-[var(--text-muted)]" use:tooltip={"Shared note"}>
						<Users class="h-5 w-5" />
					</span>
				{/if}

				<!-- Archive button (only for saved notes) -->
				{#if !currentlyNew}
					<button
						onclick={handleArchive}
						class="rounded-sm p-2 hover:bg-[var(--border)]/10"
						use:tooltip={"Archive"}
						data-testid="archive-note-btn"
					>
						<Archive class="h-5 w-5" />
					</button>
				{/if}

				<!-- Overflow menu trigger -->
				<button
					bind:this={overflowBtnEl}
					onclick={() => (showOverflowMenu = !showOverflowMenu)}
					class="rounded-sm p-2 hover:bg-[var(--border)]/10"
					use:tooltip={"More"}
					data-testid="overflow-menu-btn"
				>
					<EllipsisVertical class="h-5 w-5" />
				</button>
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

	<!-- Overflow menu dropdown (rendered outside the card to escape overflow-hidden) -->
	{#if showOverflowMenu && overflowBtnEl}
		{@const rect = overflowBtnEl.getBoundingClientRect()}
		<div
			bind:this={overflowMenuEl}
			class="fixed z-50 w-max whitespace-nowrap rounded-sm border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1 shadow-[var(--card-shadow)]"
			style="bottom: {window.innerHeight - rect.top + 4}px; right: {window.innerWidth - rect.right}px;"
			data-testid="overflow-menu"
		>
			<!-- Checklist mode toggle -->
			<button
				onclick={() => { checklistMode = !checklistMode; showOverflowMenu = false; }}
				class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--border)]/10"
				data-testid="checklist-toggle"
			>
				{#if checklistMode}
					<Type class="h-4 w-4" />
					Switch to text
				{:else}
					<SquareCheck class="h-4 w-4" />
					Checklist mode
				{/if}
			</button>

			<!-- Markdown mode toggle (not available in checklist mode) -->
			{#if !checklistMode}
				<button
					onclick={() => { toggleMarkdownMode(); showOverflowMenu = false; }}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--border)]/10"
					data-testid="markdown-toggle"
				>
					{#if rawMarkdownMode}
						<FileText class="h-4 w-4" />
						Rich text mode
					{:else}
						<FileCode class="h-4 w-4" />
						Markdown mode
					{/if}
				</button>
			{/if}

			<!-- History -->
			{#if !currentlyNew}
				<button
					onclick={() => { toggleHistory(); showOverflowMenu = false; }}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--border)]/10"
					data-testid="history-toggle"
				>
					<History class="h-4 w-4 {showHistory ? 'text-[var(--primary)]' : ''}" />
					Version history
				</button>
			{/if}

			<!-- Trash (only for saved notes) -->
			{#if !currentlyNew}
				<div class="my-1 border-t border-[var(--border-subtle)]"></div>
				<button
					onclick={handleTrash}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--destructive)] hover:bg-[var(--border)]/10"
					data-testid="trash-note-btn"
				>
					<Trash2 class="h-4 w-4" />
					Move to trash
				</button>
			{/if}

			<!-- Checklist-specific actions -->
			{#if checklistMode}
				<div class="my-1 border-t border-[var(--border-subtle)]"></div>
				{#if hasDoneItems}
					<button
						onclick={deleteCheckedItems}
						class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--border)]/10"
						data-testid="delete-checked-btn"
					>
						<Trash2 class="h-4 w-4" />
						Delete checked
					</button>
				{/if}
				<button
					onclick={uncheckAllItems}
					class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text)] hover:bg-[var(--border)]/10"
					data-testid="uncheck-all-btn"
				>
					<ListX class="h-4 w-4" />
					Uncheck all
				</button>
			{/if}
		</div>
	{/if}
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
